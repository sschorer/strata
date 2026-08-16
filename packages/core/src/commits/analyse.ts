import type { ParsedCommit, RawCommit } from '@strata/sdk';
import { bucketBy } from './buckets.js';
import type { CommitAnalytics } from './types.js';
import { weeklyActivity } from './weeks.js';

/**
 * Fold a history window into the numbers the *Commit analytics* screen prints.
 *
 * The convention plugin decides what one commit *means*; nothing so far counts
 * what a thousand of them add up to, and every reader that wants the total —
 * a screen, an overview card, a CI gate — would otherwise walk the whole log
 * itself and reach its own quietly different answer.
 *
 * `log` dates the activity series and sizes the window, `parsed` carries what
 * the convention made of each message. They describe the same commits in the
 * same order, and neither fold reads the other's list, so a window that no
 * convention parsed still reports its activity.
 */
export function analyseCommits(
  log: readonly RawCommit[],
  parsed: readonly ParsedCommit[],
): CommitAnalytics {
  let valid = 0;
  let breaking = 0;
  for (const commit of parsed) {
    if (commit.valid) valid += 1;
    if (commit.breaking) breaking += 1;
  }

  return {
    total: log.length,
    valid,
    invalid: parsed.length - valid,
    validRate: parsed.length > 0 ? valid / parsed.length : 0,
    breaking,
    types: bucketBy(parsed, 'type'),
    scopes: bucketBy(parsed, 'scope'),
    weeks: weeklyActivity(log),
  };
}
