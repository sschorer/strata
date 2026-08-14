import { describe, expect, it } from 'vitest';
import { parseTsconfig } from './tsconfig.js';

describe('parseTsconfig', () => {
  it('reads the options module resolution needs', () => {
    const config = parseTsconfig(
      'apps/web/tsconfig.json',
      JSON.stringify({
        extends: '../../tsconfig.base.json',
        compilerOptions: {
          baseUrl: '.',
          paths: { '@app/*': ['src/*'] },
          strict: true,
        },
      }),
    );

    expect(config).toEqual({
      path: 'apps/web/tsconfig.json',
      dir: 'apps/web',
      extends: ['../../tsconfig.base.json'],
      baseUrl: '.',
      paths: { '@app/*': ['src/*'] },
    });
  });

  it('reads the comments and trailing commas a tsconfig is written with', () => {
    const config = parseTsconfig(
      'tsconfig.json',
      `{
        // The project's own sources live under src/.
        "compilerOptions": {
          "paths": {
            "@app/*": ["src/*"], /* everything else is a package */
          },
        },
      }`,
    );

    expect(config?.paths).toEqual({ '@app/*': ['src/*'] });
  });

  it('does not mistake a comment marker inside a value for a comment', () => {
    const config = parseTsconfig(
      'tsconfig.json',
      '{ "compilerOptions": { "baseUrl": "./a//b", "paths": { "x": ["y/*"] } } }',
    );

    expect(config?.baseUrl).toBe('./a//b');
  });

  it('takes a list of extends and the root directory', () => {
    const config = parseTsconfig(
      'tsconfig.json',
      JSON.stringify({ extends: ['./a.json', './b.json'] }),
    );

    expect(config).toEqual({
      path: 'tsconfig.json',
      dir: '',
      extends: ['./a.json', './b.json'],
    });
  });

  it('drops a paths entry that is not a list of strings', () => {
    const config = parseTsconfig(
      'tsconfig.json',
      JSON.stringify({ compilerOptions: { paths: { '@app/*': 'src/*' } } }),
    );

    expect(config?.paths).toBeUndefined();
  });

  it('returns nothing for a file that is not a JSON object', () => {
    expect(parseTsconfig('tsconfig.json', '// only a comment')).toBeUndefined();
    expect(parseTsconfig('tsconfig.json', '[]')).toBeUndefined();
  });
});
