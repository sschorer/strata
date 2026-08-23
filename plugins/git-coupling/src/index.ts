import {
  defineStage,
  type MetricSeries,
  type StageContext,
} from '@strata/sdk';
import { changedFilesByCommit } from './commits.js';
import { rankCoupling, type CouplingOptions } from './coupling.js';
import { countCoChanges } from './pairs.js';

/**
 * Change coupling (temporal coupling): files that keep changing in the same
 * commits.
 *
 * Where hotspots ask "which file costs the most?", coupling asks "which files
 * cannot be changed alone?" — a pair the compiler knows nothing about (a
 * component and its test fixture, an API route and a client) but that every
 * change has to touch together. High coupling across module boundaries is the
 * architectural smell worth acting on.
 *
 * A stage: the manifest declares that it consumes the commit log, produces a
 * metric series and wants every file — every file, because a pair is only
 * reported while both of its paths still exist, and that is a question about
 * the whole tree rather than about one language.
 */

/**
 * Defaults, in the spirit of code-maat's but a little looser so a young repo
 * still produces a signal.
 */
const DEFAULTS: CouplingOptions = {
  minChanges: 3,
  minSharedChanges: 2,
  minDegree: 30,
  limit: 500,
};

/** Commits touching more files than this are skipped — see `countCoChanges`. */
const MAX_FILES_PER_COMMIT = 30;

export default defineStage<'metrics'>({
  async run(ctx: StageContext): Promise<MetricSeries> {
    const commits = await changedFilesByCommit(ctx, ctx.history);
    const coChanges = countCoChanges(commits, MAX_FILES_PER_COMMIT);
    const present = new Set(ctx.files.map((f) => f.path));

    return {
      id: 'change-coupling',
      label: 'Change coupling (files that change together)',
      unit: '%',
      points: rankCoupling(coChanges, present, DEFAULTS),
    };
  },
});
