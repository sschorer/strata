/**
 * Origin of `@strata/server`. Empty by default: in production the server
 * serves this build, and in dev Vite proxies the API paths to it, so the same
 * relative URLs work in both. Point `VITE_STRATA_API` at another origin (which
 * then needs CORS) when running the UI against a remote workbench.
 */
const configured = import.meta.env.VITE_STRATA_API;

export const API_BASE = (configured ?? '').replace(/\/$/, '');

/** Absolute or relative URL for an API path such as `/plugins`. */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
