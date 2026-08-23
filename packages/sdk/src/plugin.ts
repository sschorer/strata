import type { CommitConventionPlugin } from './commit.js';
import type { LanguagePlugin } from './language.js';
import type { GitMetricPlugin } from './metric.js';
import type { StagePlugin } from './stage-plugin.js';

/** Every plugin, as one discriminated union the registry can switch on. */
export type StrataPlugin =
  | StagePlugin
  | LanguagePlugin
  | CommitConventionPlugin
  | GitMetricPlugin;
