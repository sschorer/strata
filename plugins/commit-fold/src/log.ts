import type { ParsedCommit, StageInput } from '@strata/sdk';

/**
 * The parsed log this fold counts, out of everything that produced one.
 *
 * Picked by **output type** rather than by plugin id: the fold counts what a
 * gitmoji or a Jira convention made of the history exactly as it counts the
 * conventional one, and it never learns which of them is installed. Conventions
 * are an exclusive group, so at most one arrives — and the first is taken
 * rather than the union if a workbench somehow holds two, because two logs over
 * the same window are two answers, not twice the history.
 *
 * Nothing arrives when no convention is loaded, and folding an empty log is the
 * honest reading of an unjudged history: it still has activity, and it conforms
 * to nothing in particular.
 */
export function parsedLog(produced: StageInput<'commits'>): ParsedCommit[] {
  return Object.values(produced)[0] ?? [];
}
