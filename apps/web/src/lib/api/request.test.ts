import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './request';

function stubFetch(impl: typeof fetch): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('returns the parsed JSON body', async () => {
    stubFetch(async () => Response.json({ status: 'ok' }));

    await expect(apiRequest<{ status: string }>('/health')).resolves.toEqual({
      status: 'ok',
    });
  });

  it('GETs without a content-type and asks for JSON', async () => {
    const fetchMock = stubFetch(async () => Response.json({}));

    await apiRequest('/plugins');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/plugins');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual({ accept: 'application/json' });
  });

  it('serialises a body and sets the content-type', async () => {
    const fetchMock = stubFetch(async () => Response.json({ rev: 'abc' }));

    await apiRequest('/analyze', { method: 'POST', body: { root: '/repo' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"root":"/repo"}');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('passes the abort signal through', async () => {
    const fetchMock = stubFetch(async () => Response.json({}));
    const controller = new AbortController();

    await apiRequest('/health', { signal: controller.signal });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it("reports the server's own message for a failed request", async () => {
    stubFetch(async () =>
      Response.json(
        { statusCode: 400, error: 'Bad Request', message: 'root is required' },
        { status: 400 },
      ),
    );

    const error = await apiRequest('/analyze', {
      method: 'POST',
      body: {},
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: 'root is required' });
  });

  it('falls back to the status line when the error is not JSON', async () => {
    stubFetch(
      async () =>
        new Response('<html>oops</html>', {
          status: 500,
          statusText: 'Internal Server Error',
        }),
    );

    const error = await apiRequest('/health').catch((err: unknown) => err);

    expect(error).toMatchObject({
      status: 500,
      message: '500 Internal Server Error',
    });
  });

  it('turns an unreachable server into an ApiError, not a raw fetch failure', async () => {
    const cause = new TypeError('Failed to fetch');
    stubFetch(async () => {
      throw cause;
    });

    const error = await apiRequest('/health').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, cause });
    expect((error as ApiError).message).toContain('Cannot reach');
  });
});
