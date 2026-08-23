import type { AnalysisReport } from '$lib/api';
import { outputsProducing } from '$lib/stages';

/** What the dead-code stat card prints: how much, and over how many files. */
export interface DeadCodeCount {
  findings: number;
  /** Distinct files at least one finding names. */
  files: number;
}

/**
 * The dead code every stage that produced a graph found, counted.
 *
 * A finding is per *symbol*, so a barrel exporting twenty unused names is
 * twenty findings in one file — the card prints both numbers rather than
 * letting one file read as twenty problems.
 *
 * Counted over what the succeeding stages said and nothing else. A stage that
 * failed contributes no findings *and* no zero: the card asks separately what
 * became of the graph stages, because "no dead code" and "nobody looked" must
 * not print the same number (`docs/adr/0015`).
 */
export function deadCodeCount(report: AnalysisReport): DeadCodeCount {
  const files = new Set<string>();
  let findings = 0;

  for (const { output } of outputsProducing(report, 'graph')) {
    for (const finding of output.deadCode) {
      findings += 1;
      files.add(finding.path);
    }
  }

  return { findings, files: files.size };
}
