import { apiUrl } from './base';

/** Every failed call surfaces as this, so views can render one error shape. */
export class ApiError extends Error {
  constructor(
    readonly url: string,
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialised as JSON; sets the content-type. */
  body?: unknown;
  signal?: AbortSignal;
}

/** One JSON round-trip against the server, with failures normalised. */
export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {},
): Promise<T> {
  const url = apiUrl(path);
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    // A network-level failure usually means the server simply is not up —
    // say so rather than leaking "Failed to fetch" into the UI.
    throw new ApiError(url, 0, `Cannot reach the Strata server at ${url}.`, {
      cause: err,
    });
  }

  if (!response.ok) {
    throw new ApiError(
      url,
      response.status,
      await errorMessage(response),
    );
  }

  return (await response.json()) as T;
}

/** Fastify reports errors as `{ statusCode, error, message }`; use that if present. */
async function errorMessage(response: Response): Promise<string> {
  const fallback = `${response.status} ${response.statusText}`;
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'message' in payload &&
      typeof payload.message === 'string'
    ) {
      return payload.message;
    }
  } catch {
    // Not JSON — the status line is all we have.
  }
  return fallback;
}
