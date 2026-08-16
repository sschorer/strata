import { apiRequest } from './request';
import type { ProjectConfig, ProjectConfigPatch } from './types';

/**
 * `GET /projects/:id/config` — what an analysis of this project does. The
 * server merges the stored (sparse) settings with its defaults, so what comes
 * back is a whole config whichever fields were ever set.
 */
export function fetchProjectConfig(
  id: string,
  signal?: AbortSignal,
): Promise<ProjectConfig> {
  return apiRequest<ProjectConfig>(
    `/projects/${encodeURIComponent(id)}/config`,
    { signal },
  );
}

/**
 * `PATCH /projects/:id/config` — merge a patch and answer with the config as
 * it now stands. The server normalises what it stores (trims, drops blanks,
 * collapses duplicates), so its answer is the value to hold, not the patch.
 * Fails with 400 on an empty patch or a value it cannot store, 404 for an
 * unknown id.
 */
export function updateProjectConfig(
  id: string,
  patch: ProjectConfigPatch,
  signal?: AbortSignal,
): Promise<ProjectConfig> {
  return apiRequest<ProjectConfig>(
    `/projects/${encodeURIComponent(id)}/config`,
    { method: 'PATCH', body: patch, signal },
  );
}
