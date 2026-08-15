/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Items are packed into rows along the shorter side of the space that is left,
 * a row being closed as soon as adding one more tile would make its worst
 * aspect ratio worse. The result is tiles close to square, which is what makes
 * a treemap comparable by eye: area reads as area, not as a thin sliver.
 *
 * The layout is pure geometry in whatever units the caller passes — the view
 * hands it the box's aspect ratio and positions the tiles in percentages, so
 * nothing here has to know about pixels or resizing.
 */

export interface TreemapTile<T> {
  item: T;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Lay `items` out in a `width × height` box, ordered largest weight first.
 * Items without a positive, finite weight take no area and are dropped.
 */
export function squarify<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  width: number,
  height: number,
): TreemapTile<T>[] {
  // `NaN <= 0` is false, so an unchecked box would sail past a positive test
  // and lay every tile out at `NaN`. Nothing can be drawn in a box that is not
  // a size, so nothing is.
  if (!Number.isFinite(width) || !Number.isFinite(height)) return [];
  if (width <= 0 || height <= 0) return [];

  const weighted = items
    .map((item) => ({ item, weight: weightOf(item) }))
    .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Individually finite weights can still sum past `Number.MAX_VALUE`, and a
  // total of `Infinity` scales every area to zero — which divides to `NaN`.
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  if (!Number.isFinite(total) || total === 0) return [];

  // Weights become areas up front, so the row maths is plain geometry.
  const scale = (width * height) / total;
  const areas = weighted.map((entry) => entry.weight * scale);

  const tiles: TreemapTile<T>[] = [];
  const free: Box = { x: 0, y: 0, width, height };
  let row: number[] = [];
  let start = 0;

  for (const area of areas) {
    const side = Math.min(free.width, free.height);
    if (row.length > 0 && worst([...row, area], side) > worst(row, side)) {
      placeRow(row, free, tiles, weighted, start);
      start += row.length;
      row = [];
    }
    row.push(area);
  }
  placeRow(row, free, tiles, weighted, start);

  return tiles;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Fill one row along the shorter side of `free`, then shrink `free` by the
 * band the row consumed.
 */
function placeRow<T>(
  row: readonly number[],
  free: Box,
  tiles: TreemapTile<T>[],
  weighted: readonly { item: T }[],
  start: number,
): void {
  if (row.length === 0) return;

  const total = row.reduce((sum, area) => sum + area, 0);
  const horizontal = free.width <= free.height;
  const side = horizontal ? free.width : free.height;
  const thickness = total / side;

  let offset = horizontal ? free.x : free.y;
  row.forEach((area, index) => {
    const length = area / thickness;
    tiles.push({
      item: weighted[start + index]!.item,
      x: horizontal ? offset : free.x,
      y: horizontal ? free.y : offset,
      width: horizontal ? length : thickness,
      height: horizontal ? thickness : length,
    });
    offset += length;
  });

  if (horizontal) {
    free.y += thickness;
    free.height -= thickness;
  } else {
    free.x += thickness;
    free.width -= thickness;
  }
}

/** Worst (largest) aspect ratio in a row laid along `side`. */
function worst(row: readonly number[], side: number): number {
  const total = row.reduce((sum, area) => sum + area, 0);
  const max = Math.max(...row);
  const min = Math.min(...row);
  const totalSquared = total * total;
  const sideSquared = side * side;
  return Math.max(
    (sideSquared * max) / totalSquared,
    totalSquared / (sideSquared * min),
  );
}
