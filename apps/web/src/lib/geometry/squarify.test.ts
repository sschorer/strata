import { describe, expect, it } from 'vitest';
import { squarify, type TreemapTile } from './squarify';

interface Item {
  id: string;
  weight: number;
}

const weightOf = (item: Item) => item.weight;
const area = (tile: TreemapTile<Item>) => tile.width * tile.height;

function overlaps(a: TreemapTile<Item>, b: TreemapTile<Item>): boolean {
  const epsilon = 1e-9;
  return (
    a.x + a.width - epsilon > b.x &&
    b.x + b.width - epsilon > a.x &&
    a.y + a.height - epsilon > b.y &&
    b.y + b.height - epsilon > a.y
  );
}

describe('squarify', () => {
  const items: Item[] = [
    { id: 'a', weight: 6 },
    { id: 'b', weight: 6 },
    { id: 'c', weight: 4 },
    { id: 'd', weight: 3 },
    { id: 'e', weight: 2 },
    { id: 'f', weight: 2 },
    { id: 'g', weight: 1 },
  ];

  it('gives each tile an area proportional to its weight', () => {
    const tiles = squarify(items, weightOf, 6, 4);
    const total = items.reduce((sum, item) => sum + item.weight, 0);

    for (const tile of tiles) {
      expect(area(tile)).toBeCloseTo((tile.item.weight / total) * 24, 6);
    }
  });

  it('fills the box without overlapping', () => {
    const tiles = squarify(items, weightOf, 6, 4);

    expect(tiles.reduce((sum, tile) => sum + area(tile), 0)).toBeCloseTo(24, 6);
    for (const tile of tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(-1e-9);
      expect(tile.y).toBeGreaterThanOrEqual(-1e-9);
      expect(tile.x + tile.width).toBeLessThanOrEqual(6 + 1e-9);
      expect(tile.y + tile.height).toBeLessThanOrEqual(4 + 1e-9);
    }
    for (let i = 0; i < tiles.length; i += 1) {
      for (let j = i + 1; j < tiles.length; j += 1) {
        expect(overlaps(tiles[i]!, tiles[j]!)).toBe(false);
      }
    }
  });

  it('keeps tiles close to square rather than slivered', () => {
    const tiles = squarify(items, weightOf, 6, 4);

    for (const tile of tiles) {
      const ratio =
        Math.max(tile.width, tile.height) / Math.min(tile.width, tile.height);
      expect(ratio).toBeLessThan(3);
    }
  });

  it('orders tiles largest first, whatever order it was given', () => {
    const weights = squarify([...items].reverse(), weightOf, 6, 4).map(
      (tile) => tile.item.weight,
    );
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
    expect(weights[0]).toBe(6);
  });

  it('drops weights that cannot claim area', () => {
    const tiles = squarify(
      [
        { id: 'a', weight: 5 },
        { id: 'zero', weight: 0 },
        { id: 'nan', weight: Number.NaN },
      ],
      weightOf,
      4,
      4,
    );

    expect(tiles.map((tile) => tile.item.id)).toEqual(['a']);
    expect(area(tiles[0]!)).toBeCloseTo(16, 6);
  });

  it('has nothing to lay out in an empty or collapsed box', () => {
    expect(squarify([], weightOf, 4, 4)).toEqual([]);
    expect(squarify(items, weightOf, 0, 4)).toEqual([]);
  });
});
