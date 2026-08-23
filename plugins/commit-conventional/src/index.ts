import { defineStage, type ParsedCommit, type StageContext } from '@strata/sdk';
import { parseCommit } from './parse.js';

/**
 * Conventional Commits, as a stage: the analysed history window, read into a
 * parsed commit log.
 *
 * The manifest declares the whole of where it sits. It consumes `commits`,
 * which is how the core knows to hand it the run's history window — a
 * `RawCommit` is the repository's own record and no stage produces one — and it
 * produces `commits`, the same window as this convention read it. It declares
 * no filter: a convention reads messages, and the tree is none of its business.
 *
 * It also declares the exclusive group **`commit-convention`**, because a
 * repository has one convention and "96% conforming" only means something
 * relative to one. However many conventions are loaded, configuration names the
 * active one and the graph sees exactly one parsed log — which is what lets the
 * fold downstream consume that log by output type without ever asking who
 * produced it.
 *
 * Swap this plugin out for gitmoji / Jira / a custom convention without
 * touching the core: parsing one message is `parse.ts`, and everything else
 * here is the declaration above.
 */
export default defineStage<'commits'>({
  async run(ctx: StageContext): Promise<ParsedCommit[]> {
    return ctx.history.map(parseCommit);
  },
});
