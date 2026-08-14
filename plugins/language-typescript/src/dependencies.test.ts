import { describe, expect, it } from 'vitest';
import { packageName, unusedDependencies } from './dependencies.js';
import type { PackageManifest } from './manifest.js';

const manifest = (dir: string, ...deps: string[]): PackageManifest => ({
  path: dir ? `${dir}/package.json` : 'package.json',
  dir,
  dependencies: deps.map((name, i) => ({ name, line: i + 1 })),
  entries: [],
});

describe('packageName', () => {
  it('reduces a specifier to the package it names', () => {
    expect(packageName('lodash')).toBe('lodash');
    expect(packageName('lodash/merge')).toBe('lodash');
    expect(packageName('@strata/sdk')).toBe('@strata/sdk');
    expect(packageName('@strata/sdk/deep')).toBe('@strata/sdk');
  });

  it('names no package for paths, built-ins and subpath imports', () => {
    expect(packageName('./local.js')).toBeUndefined();
    expect(packageName('/absolute.js')).toBeUndefined();
    expect(packageName('#internal')).toBeUndefined();
    expect(packageName('node:path')).toBeUndefined();
    expect(packageName('fs')).toBeUndefined();
  });
});

describe('unusedDependencies', () => {
  it('reports a declared dependency nothing imports', () => {
    const findings = unusedDependencies(
      [manifest('', 'used', 'unused')],
      [{ path: 'src/a.ts', specs: ['used/deep', 'node:path', './b.js'] }],
    );

    expect(findings).toEqual([
      { path: 'package.json', symbol: 'unused', line: 2, reason: 'unused-dependency' },
    ]);
  });

  it('scopes a dependency to the package that declares it', () => {
    const findings = unusedDependencies(
      [manifest('packages/a', 'shared'), manifest('packages/b', 'shared')],
      [{ path: 'packages/a/src/x.ts', specs: ['shared'] }],
    );

    // b's own declaration is unused, even though a imports the same package.
    expect(findings).toEqual([
      {
        path: 'packages/b/package.json',
        symbol: 'shared',
        line: 1,
        reason: 'unused-dependency',
      },
    ]);
  });

  it('leaves type packages alone — the compiler imports them, not the code', () => {
    expect(
      unusedDependencies([manifest('', '@types/node')], []),
    ).toEqual([]);
  });
});
