import type { ParsedCommit } from '@strata/sdk';

/** What a commit with no recognised type is filed under. */
export const OTHER_TYPE = 'other';

/** One change type in the analysed history window. */
export interface CommitTypeRow {
  /** The convention's type — `feat`, `fix`, … — or `other`. */
  type: string;
  count: number;
  /** 0–1 of every commit in the window. */
  share: number;
  /** How many of them announced a breaking change. */
  breaking: number;
}

/** The commit stat card's three numbers. */
export interface CommitTotals {
  total: number;
  /** Commits the convention plugin could parse at all. */
  valid: number;
  breaking: number;
}

/**
 * The history window, grouped by change type.
 *
 * Biggest first, ties by name, so two runs of the same analysis print the same
 * order. A commit the convention did not recognise has no type by contract, so
 * it lands in `other` rather than being dropped — a repository where half the
 * history is unconventional should say so.
 */
export function commitTypes(commits: readonly ParsedCommit[]): CommitTypeRow[] {
  const counts = new Map<string, { count: number; breaking: number }>();

  for (const commit of commits) {
    const type = commit.type ?? OTHER_TYPE;
    const entry = counts.get(type) ?? { count: 0, breaking: 0 };
    entry.count += 1;
    if (commit.breaking) entry.breaking += 1;
    counts.set(type, entry);
  }

  return [...counts]
    .map(([type, entry]) => ({
      type,
      count: entry.count,
      share: commits.length > 0 ? entry.count / commits.length : 0,
      breaking: entry.breaking,
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

/** The same window, folded to what one stat card prints. */
export function commitTotals(commits: readonly ParsedCommit[]): CommitTotals {
  let valid = 0;
  let breaking = 0;

  for (const commit of commits) {
    if (commit.valid) valid += 1;
    if (commit.breaking) breaking += 1;
  }

  return { total: commits.length, valid, breaking };
}
