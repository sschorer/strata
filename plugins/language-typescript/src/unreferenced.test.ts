import { describe, expect, it } from 'vitest';
import { unreferencedExports, type FileSymbols } from './unreferenced.js';

/** A file offering `names`, one export per line. */
const offers = (path: string, ...names: string[]): FileSymbols => ({
  path,
  exports: names.map((name, i) => ({ name, line: i + 1 })),
  uses: [],
  stars: [],
});

describe('unreferencedExports', () => {
  it('reports an export no other file imports', () => {
    const files: FileSymbols[] = [
      offers('used.ts', 'kept', 'dropped'),
      {
        ...offers('main.ts'),
        uses: [{ to: 'used.ts', names: ['kept'], namespace: false }],
      },
    ];

    expect(unreferencedExports(files, new Set(['main.ts']), new Set())).toEqual([
      { path: 'used.ts', symbol: 'dropped', line: 2, reason: 'unreferenced-export' },
    ]);
  });

  it('counts a whole-module import as using everything', () => {
    const files: FileSymbols[] = [
      offers('lib.ts', 'a', 'b'),
      { ...offers('main.ts'), uses: [{ to: 'lib.ts', names: [], namespace: true }] },
    ];

    expect(unreferencedExports(files, new Set(['main.ts']), new Set())).toEqual([]);
  });

  it('keeps an entry point and everything its barrel forwards', () => {
    const files: FileSymbols[] = [
      { ...offers('index.ts', 'own'), stars: ['lib.ts'] },
      offers('lib.ts', 'forwarded'),
    ];

    expect(unreferencedExports(files, new Set(['index.ts']), new Set())).toEqual(
      [],
    );
  });

  it('follows a name through a barrel to the file that declares it', () => {
    const files: FileSymbols[] = [
      {
        ...offers('main.ts'),
        uses: [{ to: 'barrel.ts', names: ['wanted'], namespace: false }],
      },
      { ...offers('barrel.ts'), stars: ['a.ts', 'b.ts'] },
      offers('a.ts', 'wanted'),
      offers('b.ts', 'ignored'),
    ];

    expect(unreferencedExports(files, new Set(['main.ts']), new Set())).toEqual([
      { path: 'b.ts', symbol: 'ignored', line: 1, reason: 'unreferenced-export' },
    ]);
  });

  it('survives barrels that re-export each other', () => {
    const files: FileSymbols[] = [
      {
        ...offers('main.ts'),
        uses: [{ to: 'a.ts', names: ['missing'], namespace: false }],
      },
      { ...offers('a.ts'), stars: ['b.ts'] },
      { ...offers('b.ts', 'here'), stars: ['a.ts'] },
    ];

    expect(unreferencedExports(files, new Set(['main.ts']), new Set())).toEqual([
      { path: 'b.ts', symbol: 'here', line: 1, reason: 'unreferenced-export' },
    ]);
  });

  it('stays quiet about files already reported whole', () => {
    const files = [offers('orphan.ts', 'a', 'b')];

    expect(
      unreferencedExports(files, new Set(['main.ts']), new Set(['orphan.ts'])),
    ).toEqual([]);
  });
});
