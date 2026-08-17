// Imported by module rather than through `$lib/api`: see the note in
// `api/request.ts` about the two barrels.
import { apiRequest } from '$lib/api/request';

/**
 * Does the server answer to this token?
 *
 * `/plugins` is the cheapest guarded endpoint — no path to resolve, no
 * repository to read, and it is behind the same hook as everything else. It
 * resolves when the token works and rejects with the `ApiError` that says why
 * not, which is a 401 for the wrong token and a 0 for a server that is down.
 */
export async function verifyToken(token: string): Promise<void> {
  await apiRequest('/plugins', { token });
}
