import { describe, expect, it } from 'vitest';
import { parseImports, type ImportSite } from './imports.js';
import { withSyntaxTree } from './parser.js';

const importsOf = (source: string, path = 'a.ts'): Promise<ImportSite[]> =>
  withSyntaxTree(path, source, parseImports);

describe('parseImports', () => {
  it('reads the names out of every import form', async () => {
    const sites = await importsOf(
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
      { spec: './both.js', names: ['default', 'd'], namespace: false },
      { spec: './star.js', names: [], namespace: true },
      { spec: './side-effect.js', names: [], namespace: false },
      { spec: './types.js', names: ['T'], namespace: false },
      { spec: './mixed.js', names: ['U', 'v'], namespace: false },
    ]);
  });

  it('treats a whole-module import as consuming everything', async () => {
    const sites = await importsOf(
      [
        `const lazy = await import('./lazy.js');`,
        `const legacy = require('./legacy.js');`,
        `import bridged = require('./bridged.js');`,
      ].join('\n'),
    );

    expect(sites).toEqual([
      { spec: './lazy.js', names: [], namespace: true },
      { spec: './legacy.js', names: [], namespace: true },
      { spec: './bridged.js', names: [], namespace: true },
    ]);
  });

  it('finds a dynamic import wherever it is called', async () => {
    const sites = await importsOf(
      [
        'export async function route(slow: boolean) {',
        '  if (slow) {',
        `    const { render } = await import('./heavy.js');`,
        '    return render();',
        '  }',
        `  return import(\`./light.js\`);`,
        '}',
      ].join('\n'),
    );

    expect(sites).toEqual([
      { spec: './heavy.js', names: [], namespace: true },
      { spec: './light.js', names: [], namespace: true },
    ]);
  });

  it('ignores a specifier only the runtime knows', async () => {
    const sites = await importsOf(
      [
        'const lang = pick();',
        'await import(`./locales/${lang}.js`);',
        'await import(name);',
      ].join('\n'),
    );

    expect(sites).toEqual([]);
  });

  it('spans a multi-line clause and keeps `from` out of the names', async () => {
    const sites = await importsOf(
      ['import {', '  fromPairs,', '  merge,', "} from 'lodash';"].join('\n'),
    );

    expect(sites).toEqual([
      { spec: 'lodash', names: ['fromPairs', 'merge'], namespace: false },
    ]);
  });

  it('is not fooled by import.meta, a comment or a later string', async () => {
    const sites = await importsOf(
      [
        'const here = import.meta.dirname;',
        `// import { old } from './removed.js';`,
        `const spec = './x.js';`,
      ].join('\n'),
    );

    expect(sites).toEqual([]);
  });

  it('reads imports out of a JSX file', async () => {
    const sites = await importsOf(
      [
        `import { Button } from './button.js';`,
        'export const Row = () => <Button label="a < b" />;',
      ].join('\n'),
      'row.tsx',
    );

    expect(sites).toEqual([
      { spec: './button.js', names: ['Button'], namespace: false },
    ]);
  });
});
