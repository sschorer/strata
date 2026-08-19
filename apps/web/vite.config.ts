import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/** Where the dev server forwards API calls; the built UI is served same-origin. */
const target = process.env.STRATA_API_PROXY ?? 'http://localhost:4000';

// The API lives at the root of its origin (`/health`, not `/api/health`), so
// the dev proxy mirrors those exact paths. Dev and production then use the
// same URLs and the client needs no base-path juggling. An API path missing
// from this list does not fail loudly — the dev server answers it as a route of
// its own and 404s — so a new endpoint has to be added here as well.
// `/settings` is deliberately absent: the UI's own settings screens live under
// that path, so proxying it would send the reader's navigation to the API.
const apiPaths = [
  '/health',
  '/plugins',
  '/analyze',
  '/jobs',
  '/cache',
  '/projects',
  '/browse',
];

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    proxy: Object.fromEntries(
      apiPaths.map((path) => [path, { target, changeOrigin: true }]),
    ),
  },
});
