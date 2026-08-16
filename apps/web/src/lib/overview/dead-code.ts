import type { AnalysisReport } from '$lib/api';

/** What the dead-code stat card prints: how much, and over how many files. */
export interface DeadCodeCount {
  findings: number;
  /** Distinct files at least one finding names. */
  files: number;
}

/**
 * Every language's dead-code findings, counted.
 *
 * A finding is per *symbol*, so a barrel exporting twenty unused names is
 * twenty findings in one file — the card prints both numbers rather than
 * letting one file read as twenty problems.
 */
export function deadCodeCount(report: AnalysisReport): DeadCodeCount {
  const files = new Set<string>();
  let findings = 0;

  for (const language of Object.values(report.languages)) {
    for (const finding of language.deadCode) {
      findings += 1;
      files.add(finding.path);
    }
  }

  return { findings, files: files.size };
}
