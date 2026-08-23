import type { RawCommit } from './commit.js';
import type { RepoContext } from './repo.js';
import type { StageInputs } from './stage-inputs.js';

/**
 * What a stage is handed: the repository as this run sees it, plus everything
 * upstream of the stage produced.
 *
 * `files` is already narrowed to what the stage's **filter** matched — the core
 * applies it, so a stage never re-implements the routing and its cache key
 * covers only the files it was given (`docs/adr/0010`). A stage that declared
 * no filter reads no files of its own and gets none.
 */
export interface StageContext extends RepoContext {
  /**
   * The outputs of every stage that ran before this one, by output type and
   * then by producing plugin id — only for the types this stage declared it
   * consumes.
   */
  inputs: StageInputs;
  /**
   * The run's commit history window, newest first, as the repository holds it —
   * capped by whatever limit the run was given.
   *
   * Handed to a stage that declared it consumes `commits`, and empty for one
   * that did not, because the window is part of that stage's cache key and of
   * no other's. It is the repository's own log rather than a stage's output: a
   * `RawCommit` is not an output type, and a stage measuring *change* needs the
   * shas and the paths behind them. What a convention made of the same window
   * arrives as a parsed log in `inputs.commits`.
   */
  history: readonly RawCommit[];
}
