import type { ProducedOutputs } from '../stages/index.js';
import type { CommitAnalytics } from './types.js';

/**
 * The manifest id of the built-in commit fold — the one stage the core still
 * knows by name, and only because a fixed report field has to be filled from
 * somewhere.
 *
 * An id rather than an output type, because `aggregate` is deliberately
 * anonymous: any stage may fold numbers only it understands, so "the aggregate"
 * is not a thing a report can go and look up. It goes when
 * `report.commitAnalytics` does and every consumer reads stage entries instead
 * (`docs/adr/0011`).
 */
const COMMIT_FOLD = 'strata-commit-fold';

/** A window nobody folded: zeroes, not a division by zero and not a guess. */
const UNFOLDED: CommitAnalytics = {
  total: 0,
  valid: 0,
  invalid: 0,
  validRate: 0,
  breaking: 0,
  types: [],
  scopes: [],
  weeks: [],
};

/**
 * What the run's commit fold counted, for the report field the *Commit
 * analytics* screen still reads.
 *
 * The stage's own entry carries the same numbers keyed by manifest id, and that
 * is what a consumer will read once it does (#123). Until then this is the
 * bridge, and a workbench without the fold plugin installed reports zeroes over
 * its history — which is honest, because nothing counted it.
 */
export function foldedCommits(outputs: ProducedOutputs): CommitAnalytics {
  const folded = outputs.aggregate[COMMIT_FOLD] as CommitAnalytics | undefined;
  return folded ?? UNFOLDED;
}
