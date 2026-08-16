import type { ParsedCommit } from '@strata/sdk';
import type { CommitBucket } from './types.js';

/** The fields a parsed log can be grouped by. */
type Groupable = 'type' | 'scope';

/**
 * Group a parsed log by one of its fields.
 *
 * Biggest bucket first, ties broken by name, so two runs over the same history
 * print the same order — and the unnamed bucket (`null`) sorts last of its
 * size, because "no scope" is the residue of a list of scopes, not an entry in
 * it.
 */
export function bucketBy(
  commits: readonly ParsedCommit[],
  field: Groupable,
): CommitBucket[] {
  const counts = new Map<string | null, { count: number; breaking: number }>();

  for (const commit of commits) {
    const name = commit[field];
    const entry = counts.get(name) ?? { count: 0, breaking: 0 };
    entry.count += 1;
    if (commit.breaking) entry.breaking += 1;
    counts.set(name, entry);
  }

  return [...counts]
    .map(([name, entry]) => ({
      name,
      count: entry.count,
      share: commits.length > 0 ? entry.count / commits.length : 0,
      breaking: entry.breaking,
    }))
    .sort((a, b) => b.count - a.count || byName(a.name, b.name));
}

function byName(a: string | null, b: string | null): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}
