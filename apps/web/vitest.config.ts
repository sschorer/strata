import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// The UI is tested without SvelteKit: the plain Svelte plugin compiles both
// components and `.svelte.ts` rune modules, which is all these tests need.
// `conditions: ['browser']` picks Svelte's client build — the server build
// would render once and never react.
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    name: 'web',
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
