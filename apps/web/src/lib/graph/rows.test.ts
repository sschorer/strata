import { describe, expect, it } from 'vitest';
import { folderRows } from './rows';
import { containerOf, folderTree } from './tree';

const tree = folderTree(
  ['packages/core/src/a.ts', 'packages/sdk/src/b.ts', 'apps/web/src/c.ts'].map(
    (id) => ({ id, container: containerOf(id), weight: 1 }),
  ),
);

describe('folderRows', () => {
  it('lists the tree with a depth per row', () => {
    const rows = folderRows(tree, new Set(), new Map());

    expect(rows.map((row) => `${row.depth}:${row.name}`)).toEqual([
      '0:packages',
      '1:core/src',
      '1:sdk/src',
      '0:apps/web/src',
    ]);
  });

  it('hides what a closed folder holds, but not the folder itself', () => {
    const rows = folderRows(tree, new Set(['packages']), new Map());

    expect(rows.map((row) => row.path)).toEqual(['packages', 'apps/web/src']);
    expect(rows[0]).toMatchObject({ open: false, files: 2 });
  });

  it('flags a folder holding a file in a cycle, however deep', () => {
    const rows = folderRows(
      tree,
      new Set(),
      new Map([['packages/sdk/src/b.ts', 1]]),
    );

    expect(rows.find((row) => row.path === 'packages')!.knotted).toBe(true);
    expect(rows.find((row) => row.path === 'apps/web/src')!.knotted).toBe(false);
  });
});
