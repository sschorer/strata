import { describe, expect, it } from 'vitest';
import { aliasBases, aliasScopes } from './aliases.js';
import { parseTsconfig, type TsconfigFile } from './tsconfig.js';

const config = (path: string, json: unknown): TsconfigFile =>
  parseTsconfig(path, JSON.stringify(json))!;

const scopesOf = (...configs: TsconfigFile[]) => aliasScopes(configs);

describe('aliasScopes', () => {
  it('resolves a wildcard alias against the config that declares it', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } },
      }),
    );

    // The alias first, then `baseUrl` as TypeScript's own fallback.
    expect(aliasBases(scopes, 'src/page.ts', '@app/user')).toEqual([
      'src/user',
      '@app/user',
    ]);
  });

  it('picks the pattern with the longest matching prefix', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        compilerOptions: {
          paths: { '@app/*': ['src/*'], '@app/ui/*': ['src/components/*'] },
        },
      }),
    );

    expect(aliasBases(scopes, 'src/page.ts', '@app/ui/button')).toEqual([
      'src/components/button',
    ]);
  });

  it('tries every target of the pattern it picked, in order', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        compilerOptions: { paths: { '~/*': ['src/*', 'generated/*'] } },
      }),
    );

    expect(aliasBases(scopes, 'src/page.ts', '~/user')).toEqual([
      'src/user',
      'generated/user',
    ]);
  });

  it('matches an alias without a wildcard exactly', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        compilerOptions: { paths: { config: ['src/config/index.ts'] } },
      }),
    );

    expect(aliasBases(scopes, 'src/page.ts', 'config')).toEqual([
      'src/config/index.ts',
    ]);
    expect(aliasBases(scopes, 'src/page.ts', 'config/extra')).toEqual([]);
  });

  it('lets the nearest config win', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        compilerOptions: { paths: { '@lib/*': ['shared/*'] } },
      }),
      config('apps/web/tsconfig.json', {
        compilerOptions: { paths: { '@lib/*': ['lib/*'] } },
      }),
    );

    expect(aliasBases(scopes, 'apps/web/src/page.ts', '@lib/a')).toEqual([
      'apps/web/lib/a',
    ]);
    expect(aliasBases(scopes, 'services/api/main.ts', '@lib/a')).toEqual([
      'shared/a',
    ]);
  });

  it('inherits paths from a config it extends, relative to that config', () => {
    const scopes = scopesOf(
      config('tsconfig.base.json', {
        compilerOptions: { paths: { '@app/*': ['packages/*/src'] } },
      }),
      config('apps/web/tsconfig.json', { extends: '../../tsconfig.base' }),
    );

    expect(aliasBases(scopes, 'apps/web/main.ts', '@app/sdk')).toEqual([
      'packages/sdk/src',
    ]);
  });

  it('lets a config override what it inherits', () => {
    const scopes = scopesOf(
      config('tsconfig.base.json', {
        compilerOptions: { paths: { '@app/*': ['packages/*'] } },
      }),
      config('tsconfig.json', {
        extends: './tsconfig.base.json',
        compilerOptions: { paths: { '@app/*': ['src/*'] } },
      }),
    );

    expect(aliasBases(scopes, 'src/page.ts', '@app/user')).toEqual(['src/user']);
  });

  it('resolves a bare specifier against baseUrl alone', () => {
    const scopes = scopesOf(
      config('tsconfig.json', { compilerOptions: { baseUrl: './src' } }),
    );

    expect(aliasBases(scopes, 'src/page.ts', 'shared/user')).toEqual([
      'src/shared/user',
    ]);
  });

  it('ignores a config that governs nothing and a base outside the repo', () => {
    const scopes = scopesOf(
      // No aliases at all — nothing to say about any specifier.
      config('tsconfig.json', { extends: '@tsconfig/node24/tsconfig.json' }),
      // A variant is read only so a governing config can extend it.
      config('packages/api/tsconfig.build.json', {
        compilerOptions: { paths: { '@x/*': ['src/*'] } },
      }),
    );

    expect(scopes).toEqual([]);
    expect(aliasBases(scopes, 'packages/api/src/a.ts', '@x/b')).toEqual([]);
  });

  it('survives a config that extends itself', () => {
    const scopes = scopesOf(
      config('tsconfig.json', {
        extends: './tsconfig.json',
        compilerOptions: { paths: { '@app/*': ['src/*'] } },
      }),
    );

    expect(aliasBases(scopes, 'src/page.ts', '@app/user')).toEqual(['src/user']);
  });
});
