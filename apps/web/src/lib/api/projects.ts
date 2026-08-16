import { apiRequest } from './request';
import type {
  AddProjectRequest,
  Project,
  ProjectsResponse,
  RemoveProjectResponse,
} from './types';

/** `GET /projects` — the registry, oldest registration first. */
export function fetchProjects(signal?: AbortSignal): Promise<ProjectsResponse> {
  return apiRequest<ProjectsResponse>('/projects', { signal });
}

/**
 * `POST /projects` — register a repository. Fails with 400 when the path is
 * not inside a git repository and 409 when its root is already registered.
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
