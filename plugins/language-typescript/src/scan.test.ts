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
    expect(scanned.specs).toEqual(['./b.js']);
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
});
