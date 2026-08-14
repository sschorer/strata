import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `apps/web` has its own toolchain: `svelte-check` type-checks it, and
    // linting `.svelte` files needs eslint-plugin-svelte, which this config
    // does not carry yet.
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/node_modules/**',
      'apps/web/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // Non-null assertions are used deliberately in the git/parse paths.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
