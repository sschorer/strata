import type { RepoFile } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { resolveWorkspace, workspacePackages } from './packages.js';

const files = (...paths: string[]) =>
  new Map(paths.map((path) => [path, { path } as RepoFile]));

const manifests = [
  { path: 'packages/sdk/package.json', name: '@strata/sdk', dir: 'packages/sdk', dependencies: [], entries: [] },
  { path: 'package.json', name: 'strata', dir: '', dependencies: [], entries: [] },
];

describe('workspacePackages', () => {
  it('takes the named manifests, longest name first', () => {
    expect(workspacePackages(manifests).map((pkg) => pkg.name)).toEqual([
      '@strata/sdk',
      'strata',
    ]);
  });

  it('ignores a manifest with no name', () => {
    expect(
      workspacePackages([{ path: 'p/package.json', dir: 'p', dependencies: [], entries: [] }]),
    ).toEqual([]);
  });
});

describe('resolveWorkspace', () => {
  const packages = workspacePackages(manifests);

  it('resolves a package this repository publishes to its source', () => {
    expect(
      resolveWorkspace('@strata/sdk', packages, files('packages/sdk/src/index.ts')),
    ).toBe('packages/sdk/src/index.ts');
  });

  it('resolves a subpath inside it', () => {
    expect(
      resolveWorkspace('@strata/sdk/graph', packages, files('packages/sdk/src/graph.ts')),
    ).toBe('packages/sdk/src/graph.ts');
  });

  it('does not follow the built entry, which is not in the repository', () => {
    expect(
      resolveWorkspace('@strata/sdk', packages, files('packages/sdk/dist/index.js')),
    ).toBeUndefined();
  });

  it('leaves a third-party package alone', () => {
    expect(resolveWorkspace('svelte', packages, files('packages/sdk/src/index.ts'))).toBeUndefined();
  });
});
