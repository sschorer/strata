import { defineStage, type StageContext } from '@strata/sdk';
import { analyseCommits } from './analyse.js';
import { parsedLog } from './log.js';
import type { CommitAnalytics } from './types.js';

/**
 * The commit fold: what a history window adds up to.
 *
 * A convention decides what one commit *means*; this counts what a thousand of
 * them come to — per type and per scope, how much of the window conforms, how
 * many breaking changes it announced, and how busy each week was. Folded once,
 * here, because every reader that wants the total — the *Commit analytics*
 * screen, an overview card, a CI gate — would otherwise walk the log itself and
 * reach its own quietly different answer.
 *
 * The first stage that consumes another stage's output rather than the
 * repository: the manifest declares that it consumes `commits`, so the core
 * hands it every parsed log produced upstream *and* the run's own history
 * window, and it declares no filter because the tree is none of its business.
 * The two halves count different things — the window dates the activity series
 * and sizes the history, the parsed log carries what the convention made of
 * each message — so a window no convention parsed still reports its activity.
 *
 * It produces an `aggregate`: numbers only this stage and a consumer that means
 * it understand, which is what keeps counting commits out of the SDK's closed
 * set of output types.
 */
export default defineStage<'aggregate'>({
  async run(ctx: StageContext): Promise<CommitAnalytics> {
    return analyseCommits(ctx.history, parsedLog(ctx.inputs.commits));
  },
});
