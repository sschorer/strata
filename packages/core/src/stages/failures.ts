import type { StageEntry } from '@strata/sdk';

/**
 * Every stage that threw, in one line — what a run that kept nothing readable
 * says it went wrong on.
 *
 * The per-stage reasons are in the report either way; this is the sentence for
 * whoever is holding the failure rather than the report, which is a caller that
 * asked for a report and a job that has to say why it has none.
 */
export function failureSummary(entries: Record<string, StageEntry>): string {
  const failed: string[] = [];
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.status === 'failed') failed.push(`"${id}": ${entry.reason}`);
  }
  return failed.join('; ');
}
