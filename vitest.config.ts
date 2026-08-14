import { defineConfig } from 'vitest/config';

/**
 * One `pnpm test`, two suites. The packages and plugins are plain Node code and
 * need no configuration; `apps/web` needs the Svelte compiler and a DOM, so it
 * brings its own config (`apps/web/vitest.config.ts`) as a second project.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          include: ['{packages,plugins}/*/src/**/*.test.ts'],
        },
      },
      './apps/web',
    ],
  },
});
