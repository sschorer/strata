import { describe, expect, it } from 'vitest';
import { parseManifest } from './manifest.js';

const PACKAGE = `{
  "name": "@strata/sdk",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": { "strata": "./dist/cli.js" },
  "exports": { ".": { "import": "./dist/index.js" } },
  "scripts": { "build": "tsc -p tsconfig.json", "gen": "node scripts/gen.mjs" },
  "dependencies": {
    "used": "^1.0.0",
    "@scope/unused": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^7.0.0"
  }
}`;

describe('parseManifest', () => {
  it('collects dependencies with the line each is declared on', () => {
    const manifest = parseManifest('packages/sdk/package.json', PACKAGE);

    expect(manifest?.dir).toBe('packages/sdk');
    expect(manifest?.dependencies).toEqual([
      { name: 'used', line: 9 },
      { name: '@scope/unused', line: 10 },
    ]);
  });

  it('collects every field naming a file, nested ones included', () => {
    const manifest = parseManifest('package.json', PACKAGE);

    expect(manifest?.dir).toBe('');
    expect(manifest?.entries).toEqual([
      './dist/index.js',
      './dist/index.d.ts',
      './dist/cli.js',
      './dist/index.js',
      // Only the script's *source* file; `tsconfig.json` is not one.
      'scripts/gen.mjs',
    ]);
  });

  it('ignores a package.json that is not a JSON object', () => {
    expect(parseManifest('package.json', '{ broken')).toBeUndefined();
    expect(parseManifest('package.json', '[]')).toBeUndefined();
  });

  it('reports a dependency without a line rather than a wrong one', () => {
    // Same name in devDependencies, and the block written on one line.
    const manifest = parseManifest(
      'package.json',
      '{ "dependencies": { "a": "1" }, "devDependencies": { "b": "1" } }',
    );

    expect(manifest?.dependencies).toEqual([{ name: 'a' }]);
  });
});
