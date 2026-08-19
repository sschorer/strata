import { vi, type Mock } from 'vitest';

/** A canned response, or one built from the request body and its URL. */
type Responder = (body: unknown, url: URL) => unknown;

/**
 * What the server answers, keyed by `"<METHOD> <path>"` — or by path alone
 * when the method does not matter. A handler returns the JSON body, or a
 * `Response` when the status matters.
 */
export type ApiRoutes = Record<string, unknown>;

/**
 * Stub `fetch` for a component that talks to more than one endpoint. The
 * switcher, the plugin count and a run all live in the same frame, so a test
 * of the shell needs an API rather than a single canned response — and an
 * unstubbed path answering 404 says which one was forgotten.
 */
export function stubApi(routes: ApiRoutes): Mock {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const parsed = new URL(url, 'http://strata.test');
    const { pathname } = parsed;
    const handler = routes[`${method} ${pathname}`] ?? routes[pathname];

    if (handler === undefined) {
      return Response.json(
        { message: `No stub for ${method} ${pathname}` },
        { status: 404 },
      );
    }

    const body =
      typeof init.body === 'string'
        ? (JSON.parse(init.body) as unknown)
        : undefined;
    const value =
      typeof handler === 'function'
        ? (handler as Responder)(body, parsed)
        : handler;
    return value instanceof Response ? value : Response.json(value);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * What the API answers for one whole run: the job `POST /analyze` accepts, the
 * event stream that follows it, and the finished job behind that.
 *
 * An analysis is a job on the server rather than a request left open, so a
 * screen that runs one talks to all three — and a test of that screen stubs all
 * three. Spread it into the routes a test already needs.
 */
export function runRoutes(report: unknown, id = 'run-1'): ApiRoutes {
  const job = (state: string, extra: Record<string, unknown> = {}) => ({
    id,
    root: '/repo/strata',
    state,
    progress: null,
    queuedAt: '2026-08-15T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    report: null,
    error: null,
    ...extra,
  });
  const running = job('running', {
    startedAt: '2026-08-15T10:00:00.000Z',
    progress: { stage: 'scanning', detail: null, completed: 1, total: 0 },
  });
  const done = job('succeeded', {
    startedAt: '2026-08-15T10:00:00.000Z',
    finishedAt: '2026-08-15T10:00:02.000Z',
    report,
  });

  return {
    'POST /analyze': ((body: unknown) => ({
      job: job('queued', { root: (body as { root?: string })?.root ?? '/repo' }),
    })) satisfies Responder,
    // A fresh body per call: a stream can only be read once.
    [`/jobs/${id}/events`]: () =>
      new Response(
        [running, done]
          .map((j) => `event: ${j.state}\ndata: ${JSON.stringify(j)}\n\n`)
          .join(''),
        { headers: { 'content-type': 'text/event-stream' } },
      ),
    [`/jobs/${id}`]: { job: done },
  };
}
