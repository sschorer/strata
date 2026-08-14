/**
 * The heat ramp: five steps from cold (`h1`) to hot (`h5`), the tokens the
 * palette reserves for exactly this. Tiles are *coloured* by complexity while
 * they are *sized* by score, so the two factors of a hotspot stay readable
 * apart: a big pale tile churns a lot, a small red one is dense but quiet.
 */

export const HEAT_LEVELS = [1, 2, 3, 4, 5] as const;

export type HeatLevel = (typeof HEAT_LEVELS)[number];

export interface HeatScale {
  min: number;
  max: number;
  /** Upper bound of levels 1–4; level 5 is everything above the last. */
  breaks: readonly [number, number, number, number];
}

/**
 * Quantile breaks over the values in the current view.
 *
 * Complexity is heavily skewed — a handful of files dwarf the rest — so equal
 * *value* steps would paint almost everything cold. Equal *population* steps
 * keep all five colours on screen and make the ramp read as a ranking, which
 * is what the legend then labels.
 */
export function heatScale(values: readonly number[]): HeatScale {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return { min: 0, max: 0, breaks: [0, 0, 0, 0] };

  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    breaks: [
      quantile(sorted, 0.2),
      quantile(sorted, 0.4),
      quantile(sorted, 0.6),
      quantile(sorted, 0.8),
    ],
  };
}

export function heatLevel(scale: HeatScale, value: number): HeatLevel {
  if (value <= scale.breaks[0]) return 1;
  if (value <= scale.breaks[1]) return 2;
  if (value <= scale.breaks[2]) return 3;
  if (value <= scale.breaks[3]) return 4;
  return 5;
}

export interface HeatBand {
  level: HeatLevel;
  from: number;
  to: number;
}

/**
 * The legend's five rows: the value range each colour stands for. Repeated
 * breaks (few distinct values) collapse into empty bands, which the legend
 * renders as-is — an honest "nothing lands here".
 */
export function heatBands(scale: HeatScale): HeatBand[] {
  const bounds = [scale.min, ...scale.breaks, scale.max];
  return HEAT_LEVELS.map((level) => ({
    level,
    from: bounds[level - 1]!,
    to: bounds[level]!,
  }));
}

/** Tile background for a level — the palette token, resolved per theme. */
export function heatColor(level: HeatLevel): string {
  return `var(--strata-h${level})`;
}

/** Text colour that holds contrast on `heatColor(level)` in both themes. */
export function heatInk(level: HeatLevel): string {
  return `var(--strata-h${level}-ink)`;
}

/** Linear-interpolated quantile over an ascending array. */
function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const low = Math.floor(pos);
  const high = Math.ceil(pos);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low);
}
