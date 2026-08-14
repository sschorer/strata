import { describe, expect, it } from 'vitest';
import { entryPoints } from './entries.js';
import type { PackageManifest } from './manifest.js';

const manifest = (
  dir: string,
  entries: string[] = [],
): PackageManifest => ({
  path: dir ? `${dir}/package.json` : 'package.json',
  dir,
  dependencies: [],
  entries,
});

describe('entryPoints', () => {
  it('reads a published entry back as the source it was built from', () => {
    const paths = ['packages/sdk/src/index.ts', 'packages/sdk/src/other.ts'];

    expect(
      entryPoints(paths, [manifest('packages/sdk', ['./dist/index.js'])]),
    ).toEqual(new Set(['packages/sdk/src/index.ts']));
  });

  it('follows a types field through its .d.ts', () => {
    expect(
      entryPoints(
        ['src/index.ts'],
        [manifest('', ['./dist/index.d.ts'])],
      ),
    ).toEqual(new Set(['src/index.ts']));
  });

  it('takes tests and tool configuration as roots of their own', () => {
    const paths = [
      'src/a.test.ts',
      'src/__tests__/b.ts',
      'vite.config.ts',
      'eslint.config.js',
      'src/c.ts',
    ];

    expect(entryPoints(paths, [])).toEqual(
      new Set([
        'src/a.test.ts',
        'src/__tests__/b.ts',
        'vite.config.ts',
        'eslint.config.js',
      ]),
    );
  });

  it('falls back to a conventional index when nothing is published', () => {
    expect(
      entryPoints(['apps/cli/src/index.ts', 'apps/cli/src/run.ts'], [
        manifest('apps/cli'),
      ]),
    ).toEqual(new Set(['apps/cli/src/index.ts']));
  });

  it('takes a script a package invokes directly', () => {
    expect(
      entryPoints(['scripts/gen.mjs'], [manifest('', ['scripts/gen.mjs'])]),
    ).toEqual(new Set(['scripts/gen.mjs']));
  });

  it('finds nothing rather than guessing when a package publishes nothing', () => {
    expect(entryPoints(['src/a.ts', 'src/b.ts'], [])).toEqual(new Set());
  });
});
