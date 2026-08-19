import { apiRequest } from './request';
import type {
  AnalyzeRequest,
  JobResponse,
  JobsResponse,
} from './types';

/**
 * `POST /analyze` with `wait: false` — put a run on the queue and take the job.
 * The server answers 202 as soon as the run is accepted, so the screen has an
 * id to follow rather than a request that will not come back for minutes.
 *
 * Fails with 403 for a root outside the server's allowed ones and 404 for one
 * inside them that is not there — before the job exists, so a refused root is
 * still an error here rather than a job that fails later.
 */
export function startAnalysis(
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<JobResponse> {
  return apiRequest<JobResponse>('/analyze', {
    method: 'POST',
    body: { ...request, wait: false },
    signal,
  });
}

/** `GET /jobs/:id` — one job, with its report once it has one. */
export function fetchJob(id: string, signal?: AbortSignal): Promise<JobResponse> {
  return apiRequest<JobResponse>(`/jobs/${encodeURIComponent(id)}`, { signal });
}

/** `GET /jobs` — what the queue still remembers, newest first, without reports. */
export function fetchJobs(signal?: AbortSignal): Promise<JobsResponse> {
  return apiRequest<JobsResponse>('/jobs', { signal });
}
