import { describe, expect, it } from 'vitest';
import { parseImports } from './imports.js';

describe('parseImports', () => {
  it('reads the names out of every import form', () => {
    const sites = parseImports(
      [
        `import { a, b as c } from './named.js';`,
        `import fallback from './default.js';`,
        `import both, { d } from './both.js';`,
        `import * as ns from './star.js';`,
        `import './side-effect.js';`,
        `import type { T } from './types.js';`,
        `import { type U, v } from './mixed.js';`,
      ].join('\n'),
    );

    expect(sites).toEqual([
      { spec: './named.js', names: ['a', 'b'], namespace: false },
      { spec: './default.js', names: ['default'], namespace: false },
      { spec: './both.js', names: ['d', 'default'], namespace: false },
      { spec: './star.js', names: [], namespace: true },
      { spec: './side-effect.js', names: [], namespace: false },
      { spec: './types.js', names: ['T'], namespace: false },
      { spec: './mixed.js', names: ['U', 'v'], namespace: false },
    ]);
  });

  it('treats a whole-module import as consuming everything', () => {
    const sites = parseImports(
      [
        `const lazy = await import('./lazy.js');`,
        `const legacy = require('./legacy.js');`,
      ].join('\n'),
    );

    expect(sites).toEqual([
      { spec: './lazy.js', names: [], namespace: true },
      { spec: './legacy.js', names: [], namespace: true },
    ]);
  });

  it('spans a multi-line clause and keeps `from` out of the names', () => {
    const sites = parseImports(
      ['import {', '  fromPairs,', '  merge,', "} from 'lodash';"].join('\n'),
    );

    expect(sites).toEqual([
      { spec: 'lodash', names: ['fromPairs', 'merge'], namespace: false },
    ]);
  });

  it('is not fooled by import.meta or a later string', () => {
    // Without a guard the lazy clause would run from `import` to `'./x.js'`.
    const sites = parseImports(
      ['const here = import.meta.dirname', `const spec = './x.js'`].join('\n'),
    );

    expect(sites).toEqual([]);
  });
});
