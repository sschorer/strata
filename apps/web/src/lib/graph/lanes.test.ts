import { describe, expect, it } from 'vitest';
import { containerOf } from './tree';
import { everyLane, laneTree } from './lanes';

const ids = [
  'packages/core/src/a.ts',
  'packages/sdk/src/b.ts',
  'apps/web/c.ts',
  'README.md',
];

/** The deepest open folder holding a card, as the layout asks it. */
const deepest = (open: Set<string>) => (id: string) => {
  let folder = containerOf(id);
  while (folder !== '' && !open.has(folder)) folder = containerOf(folder);
  return folder;
};

describe('laneTree', () => {
  it('puts everything at the top when nothing is open', () => {
    const root = laneTree(ids, new Set(), containerOf, deepest(new Set()));

    expect(root.children).toEqual([]);
    expect(root.own).toEqual([...ids].sort());
  });

  it('nests an open folder inside the open folder above it', () => {
    const open = new Set(['packages', 'packages/core/src']);
    const root = laneTree(ids, open, containerOf, deepest(open));

    const packages = root.children.find((lane) => lane.path === 'packages')!;
    expect(root.children.map((lane) => lane.path)).toEqual(['packages']);
    expect(packages.children.map((lane) => lane.path)).toEqual([
      'packages/core/src',
    ]);
    expect(packages.children[0]!.own).toEqual(['packages/core/src/a.ts']);
  });

  it('hangs an open folder off the nearest open one, not its direct parent', () => {
    // `packages/core` is closed, so `…/src` belongs to `packages`.
    const open = new Set(['packages', 'packages/core/src']);
    const root = laneTree(ids, open, containerOf, deepest(open));

    expect(
      root.children.find((lane) => lane.path === 'packages/core/src'),
    ).toBeUndefined();
  });

  it('leaves cards outside every open folder at the top', () => {
    const open = new Set(['packages']);
    const root = laneTree(ids, open, containerOf, deepest(open));

    expect(root.own).toEqual(['README.md', 'apps/web/c.ts']);
  });

  it('walks every lane, outermost first', () => {
    const open = new Set(['packages', 'packages/core/src']);
    const root = laneTree(ids, open, containerOf, deepest(open));

    expect(everyLane(root).map((lane) => lane.path)).toEqual([
      '',
      'packages',
      'packages/core/src',
    ]);
  });
});
