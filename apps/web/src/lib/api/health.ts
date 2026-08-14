import { apiRequest } from './request';
import type { HealthResponse } from './types';

/** `GET /health` — liveness probe. */
export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>('/health', { signal });
}
