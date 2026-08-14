import { createHash } from 'node:crypto';

/** Consecutive code lines that must match before a run counts as a clone. */
export const CLONE_WINDOW = 6;

/** Shorter than this and a line is punctuation (`}`, `});`), not content. */
const MIN_LINE = 3;

export interface Fingerprint {
  /** How many significant lines the windows were drawn from. */
  lines: number;
  /**
   * One hash per window, in order: window `i` covers significant lines
   * `i … i + CLONE_WINDOW - 1`.
   */
  prints: string[];
}

/**
 * Window hashes of one file's code — the per-file half of duplicate detection.
 *
 * Only this half depends on the file alone, so only this half is cacheable per
 * blob; comparing the prints across files lives in `duplication.ts`.
 *
 * Expects text that went through `stripComments`: a copied block is still a
 * copy when its comments were rewritten, but two lines that differ only in a
 * string literal are two different lines.
 *
 * Whitespace is normalised so a re-indented copy still matches, and lines too
 * short to carry meaning are dropped — otherwise every file in the repo would
 * "share" its run of closing braces. Hashes are truncated because a repo's
 * worth of them is stored in the cache and 64 bits is far past collision-free
 * for the number of windows a single project has.
 */
export function fingerprint(code: string): Fingerprint {
  const lines = significantLines(code);
  const prints: string[] = [];
  for (let i = 0; i + CLONE_WINDOW <= lines.length; i++) {
    prints.push(hash(lines.slice(i, i + CLONE_WINDOW).join('\n')));
  }
  return { lines: lines.length, prints };
}

function significantLines(code: string): string[] {
  const lines: string[] = [];
  for (const line of code.split('\n')) {
    const normalised = line.trim().replace(/\s+/g, ' ');
    if (normalised.length > MIN_LINE) lines.push(normalised);
  }
  return lines;
}

function hash(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 16);
}
