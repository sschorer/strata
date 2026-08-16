import { apiRequest } from './request';
import type {
  AddProjectRequest,
  Project,
  ProjectsResponse,
  RemoveProjectResponse,
  UpdateProjectRequest,
} from './types';

/** `GET /projects` — the registry, oldest registration first. */
export function fetchProjects(signal?: AbortSignal): Promise<ProjectsResponse> {
  return apiRequest<ProjectsResponse>('/projects', { signal });
}

/**
 * `POST /projects` — register a repository. Fails with 400 when the path is
 * not inside a git repository, 403 when it — or the repository it belongs to —
 * is outside the roots the server may reach, and 409 when its root is already
 * registered.
 */
export function addProject(
  request: AddProjectRequest,
  signal?: AbortSignal,
): Promise<Project> {
  return apiRequest<Project>('/projects', {
    method: 'POST',
    body: request,
    signal,
  });
}

/**
 * `PATCH /projects/:id` — rename a project, or re-point it at another
 * repository. Identity only; what an analysis of it *does* is its config.
 * Fails with 400 on an empty patch or a path outside a repository, 403 for one
 * outside the roots the server may reach, 404 for an unknown id and 409 when
 * another project already holds the root.
 */
export function updateProject(
  id: string,
  update: UpdateProjectRequest,
  signal?: AbortSignal,
): Promise<Project> {
  return apiRequest<Project>(`/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: update,
    signal,
  });
}

/**
 * `DELETE /projects/:id` — drop the entry and its settings. A registry
 * operation only: the repository on disk is never touched.
 */
export function removeProject(
  id: string,
  signal?: AbortSignal,
): Promise<RemoveProjectResponse> {
  return apiRequest<RemoveProjectResponse>(
    `/projects/${encodeURIComponent(id)}`,
    { method: 'DELETE', signal },
  );
}
