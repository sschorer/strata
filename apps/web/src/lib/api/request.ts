// The session is imported by module rather than through `$lib/auth`, whose
// barrel reaches back here for the token check — one import each way through
// the barrels would be a cycle.
import { session } from '$lib/auth/session.svelte';
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
  /**
   * A credential to try instead of the session's — and, with it, a promise not
   * to raise the unlock prompt if it is refused. The unlock panel checks a
   * token before the session adopts it, and a wrong one there is an answer to
   * the reader, not a fresh challenge.
   */
  token?: string;
  /** What the caller will read. Defaults to JSON. */
  accept?: string;
}

/** One JSON round-trip against the server, with failures normalised. */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const response = await apiFetch(path, options);
  return (await response.json()) as T;
}

/**
 * One call against the server, answered with the `Response` itself.
 *
 * The same credential, the same normalised failures and the same unlock prompt
 * as `apiRequest` — what it does not do is read the body, because a progress
 * stream is read a frame at a time over the length of an analysis rather than
 * parsed once at the end. A browser's `EventSource` cannot carry the bearer
 * header, so a stream this app follows starts here.
 */
export async function apiFetch(
  path: string,
  {
    method = 'GET',
    body,
    signal,
    token,
    accept = 'application/json',
  }: RequestOptions = {},
): Promise<Response> {
  const url = apiUrl(path);
  const headers: Record<string, string> = { accept };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const credential = token ?? session.token;
  if (credential) headers.authorization = `Bearer ${credential}`;

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
    // A 401 is the whole app's business, not this call's: the workbench is
    // locked until a token is supplied, so the session raises the prompt once
    // and every screen behind it stops guessing why its data never came.
    if (response.status === 401 && token === undefined) session.challenge();
    throw new ApiError(
      url,
      response.status,
      await errorMessage(response),
    );
  }

  return response;
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
