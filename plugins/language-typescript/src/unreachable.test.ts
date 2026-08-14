import { describe, expect, it } from 'vitest';
import { unreachableFiles, type FileEdges } from './unreachable.js';

const file = (path: string, ...to: string[]): FileEdges => ({
  path,
  uses: to.map((t) => ({ to: t })),
  stars: [],
});

describe('unreachableFiles', () => {
  it('walks the graph from the entry point', () => {
    const files = [
      file('index.ts', 'used.ts'),
      file('used.ts', 'deep.ts'),
      file('deep.ts'),
      file('orphan.ts'),
    ];

    expect(unreachableFiles(files, new Set(['index.ts']))).toEqual(
      new Set(['orphan.ts']),
    );
  });

  it('reports an island whose files all have importers', () => {
    // a → b → a is reachable from nothing, though neither is unimported.
    const files = [file('index.ts'), file('a.ts', 'b.ts'), file('b.ts', 'a.ts')];

    expect(unreachableFiles(files, new Set(['index.ts']))).toEqual(
      new Set(['a.ts', 'b.ts']),
    );
  });

  it('follows a barrel through its star re-exports', () => {
    const files = [
      { ...file('index.ts'), stars: ['lib.ts'] },
      file('lib.ts'),
    ];

    expect(unreachableFiles(files, new Set(['index.ts']))).toEqual(new Set());
  });

  it('reports nothing when there is no entry point to start from', () => {
    const files = [file('a.ts'), file('b.ts')];

    expect(unreachableFiles(files, new Set())).toEqual(new Set());
  });
});
