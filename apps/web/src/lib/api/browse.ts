import { apiRequest } from './request';
import type { DirectoryListing } from './types';

interface BrowseQuery {
  /** Directory to list; omitted, the server answers with its first root. */
  path?: string;
  hidden?: boolean;
}

/**
 * `GET /browse` — the subdirectories of one directory on the server's machine,
 * and which of them are repositories. 403 outside the browse roots, 404 for a
 * directory that is not there.
 */
export function browseDirectory(
  { path, hidden }: BrowseQuery = {},
  signal?: AbortSignal,
): Promise<DirectoryListing> {
  const query = new URLSearchParams();
  if (path) query.set('path', path);
  if (hidden) query.set('hidden', 'true');
  const suffix = query.size > 0 ? `?${query}` : '';
  return apiRequest<DirectoryListing>(`/browse${suffix}`, { signal });
}
