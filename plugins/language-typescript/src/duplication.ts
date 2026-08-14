import { CLONE_WINDOW, type Fingerprint } from './fingerprint.js';

/** One file's fingerprint, tagged with the path it came from. */
export interface FilePrints extends Fingerprint {
  path: string;
}

/**
 * Share of each file's code that also appears somewhere else — the cross-file
 * half of duplicate detection, and the reason duplication cannot be computed
 * inside the per-blob cache: a file's answer changes when *another* file does.
 *
 * A window whose hash occurs more than once is a clone, wherever its twin sits
 * (another file, or the same file twice over). Every line such a window covers
 * is marked, and the result is the marked share of the file's significant
 * lines. Rounded to three decimals — it is a ratio for a bar in the UI, not an
 * accounting figure.
 */
export function duplicationByPath(
  files: readonly FilePrints[],
): Map<string, number> {
  const occurrences = new Map<string, number>();
  for (const file of files) {
    for (const print of file.prints) {
      occurrences.set(print, (occurrences.get(print) ?? 0) + 1);
    }
  }

  const duplication = new Map<string, number>();
  for (const file of files) {
    const duplicated = new Set<number>();
    file.prints.forEach((print, start) => {
      if ((occurrences.get(print) ?? 0) < 2) return;
      const end = Math.min(start + CLONE_WINDOW, file.lines);
      for (let line = start; line < end; line++) duplicated.add(line);
    });
    const share = file.lines === 0 ? 0 : duplicated.size / file.lines;
    duplication.set(file.path, Math.round(share * 1000) / 1000);
  }
  return duplication;
}
