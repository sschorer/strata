import type { CommitAnalytics } from '$lib/api';

/**
 * The commit aggregates of an empty history window.
 *
 * Every report carries them, and most fixtures are about something else —
 * a graph, a hotspot, a run summary — so they say "no commits" once, here,
 * instead of eight zeroes at every call site.
 */
export function noCommits(): CommitAnalytics {
  return {
    total: 0,
    valid: 0,
    invalid: 0,
    validRate: 0,
    breaking: 0,
    types: [],
    scopes: [],
    weeks: [],
  };
}
