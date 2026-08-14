import { apiRequest } from './request';
import type { PluginsResponse } from './types';

/** `GET /plugins` — what loaded, from where, and what was skipped. */
export function fetchPlugins(signal?: AbortSignal): Promise<PluginsResponse> {
  return apiRequest<PluginsResponse>('/plugins', { signal });
}
