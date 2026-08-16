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
