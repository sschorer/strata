// A single-page app: no server rendering, no prerendered routes. The build is
// static files that `@strata/server` (and later the Tauri shell) hands over
// as-is, with every route resolving through the index.html fallback.
export const ssr = false;
export const prerender = false;
