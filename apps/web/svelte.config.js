import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // A pure SPA: every route falls back to index.html, so the build is a
    // folder of static files. `@strata/server` can serve it straight from the
    // Docker image, and the Tauri shell can load it from disk — neither of
    // them wants a Node server in front of the UI.
    adapter: adapter({ fallback: 'index.html', strict: false }),
  },
};
