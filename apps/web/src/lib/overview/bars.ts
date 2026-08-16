import type { HotspotRow } from '$lib/hotspots';

/** One row of the overview's hotspot list: a name, a number and a bar. */
export interface HotspotBar {
  path: string;
  score: number;
  /** What the bar is coloured by, on the same ramp the treemap uses. */
  complexity: number;
  /** 0–1 against the top-ranked file, which is the bar's width. */
  share: number;
}

/** How many files the overview lists before the ranking becomes the treemap's job. */
export const BAR_LIMIT = 8;

/**
 * The head of the hotspot ranking, with each score as a share of the top one.
 *
 * Widths are relative to the highest score in the *report*, not to the highest
 * one shown, so the list says the same thing whether it prints eight rows or
 * three: a full bar is the worst file in the repository.
 *
 * Expects the ranking `hotspotRows` produces — it takes the head of the list
 * as given rather than sorting again.
 */
export function hotspotBars(
  rows: readonly HotspotRow[],
  limit: number = BAR_LIMIT,
): HotspotBar[] {
  const top = rows.reduce((max, row) => Math.max(max, row.score), 0);

  return rows.slice(0, limit).map((row) => ({
    path: row.path,
    score: row.score,
    complexity: row.complexity,
    share: top > 0 ? row.score / top : 0,
  }));
}
