import type { RepoFile } from '@strata/sdk';
import { describe, expect, it } from 'vitest';
import { scan } from './scan.js';

const file = (path: string, text: string): RepoFile => ({
  path,
  blob: path,
  read: async () => text,
});

describe('scan', () => {
  it('reports loc, specifiers and every metric from one read', async () => {
    const scanned = await scan(
      file(
        'a.ts',
        [
          `import { b } from './b.js';`,
          'export function f(xs: string[]) {',
          '  for (const x of xs) {',
          '    if (x) {',
          '      return x && b;',
          '    }',
          '  }',
          '  return null;',
          '}',
        ].join('\n'),
      ),
    );

    expect(scanned.loc).toBe(9);
    expect(scanned.imports).toEqual([
      { spec: './b.js', names: ['b'], namespace: false },
    ]);
    expect(scanned.exports).toEqual([{ name: 'f', line: 2 }]);
    expect(scanned.complexity).toBe(4); // for + if + &&
    expect(scanned.nesting).toBe(2);
    // The two closing braces are punctuation, not content.
    expect(scanned.fingerprint.lines).toBe(6);
  });

  it('measures the code, not the comments', async () => {
    const scanned = await scan(
      file('b.ts', '// if (a) { for (b) { c(); } }\nexport const d = 1;\n'),
    );

    expect(scanned.complexity).toBe(1);
    expect(scanned.nesting).toBe(0);
  });

  it('collects re-exports and lazy imports alongside the static ones', async () => {
    const scanned = await scan(
      file(
        'c.ts',
        [
          `export { helper } from './helper.js';`,
          `export * from './barrel.js';`,
          `export const load = () => import('./lazy.js');`,
        ].join('\n'),
      ),
    );

    expect(scanned.imports).toEqual([
      { spec: './lazy.js', names: [], namespace: true },
      { spec: './helper.js', names: ['helper'], namespace: false },
    ]);
    expect(scanned.stars).toEqual(['./barrel.js']);
  });

  it('parses a file whose syntax is broken without losing the rest', async () => {
    const scanned = await scan(
      file(
        'd.ts',
        [
          `import { A } from './a.js';`,
          'export function broken() { return }}',
          'export const after = 1;',
        ].join('\n'),
      ),
    );

    expect(scanned.imports).toEqual([
      { spec: './a.js', names: ['A'], namespace: false },
    ]);
    expect(scanned.exports.map((e) => e.name)).toContain('after');
  });
});
