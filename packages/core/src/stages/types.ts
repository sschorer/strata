import type {
  OutputType,
  RepoFile,
  StageFilter,
  StagePlugin,
  StageStatus,
} from '@strata/sdk';

/**
 * One stage as the core schedules it: everything its manifest declared, and the
 * one function the module contributes.
 *
 * Flattened off the `LoadedPlugin` it came from on purpose — ordering, filtering
 * and keying are about the declarations, and nothing below this line needs the
 * registry, the manifest path or the plugin kinds.
 */
export interface Stage {
  /** Manifest id — how the report keys this stage's entry. */
  id: string;
  /** Plugin version, as the report's provenance records it. */
  version: string;
  consumes: readonly OutputType[];
  produces: OutputType;
  /** Omitted when the stage reads no files of its own. */
  filter?: StageFilter;
  /**
   * The group of which at most one member runs, if the manifest named one.
   * Configuration names the active member.
   */
  exclusive?: string;
  run: StagePlugin['run'];
}

/**
 * One stage in a run's order: what the core matched for it, or why it will not
 * be called at all.
 */
export interface PlannedStage {
  stage: Stage;
  /** What its filter matched; empty when it declared no filter. */
  files: RepoFile[];
  /** Set when the stage will not run — the reason the report gives for it. */
  skipped?: string;
}

/**
 * A run's stages, ordered and settled before any of them runs — which is what
 * lets the progress plan count them and a reader be told about a stage that
 * never starts.
 */
export type StagePlan = readonly PlannedStage[];

/**
 * One line of a report's provenance: a stage that was planned, the version of
 * the plugin behind it, and how it ended.
 *
 * What makes two runs comparable — a gate that flipped is either a change in
 * the repository or a change in who measured it, and this is the half a report
 * would otherwise not record.
 */
export interface StageProvenance {
  id: string;
  version: string;
  status: StageStatus;
}
