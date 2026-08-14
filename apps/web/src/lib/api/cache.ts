import { apiRequest } from './request';
import type { ClearCacheResponse } from './types';

/** `DELETE /cache` — drop every cached result. */
export function clearCache(signal?: AbortSignal): Promise<ClearCacheResponse> {
  return apiRequest<ClearCacheResponse>('/cache', { method: 'DELETE', signal });
}
