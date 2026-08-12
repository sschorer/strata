import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'apps/web/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Non-null assertions are used deliberately in the git/parse paths.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
