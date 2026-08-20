import type { CommitConventionPlugin } from './commit.js';
import type { LanguagePlugin } from './language.js';
import type { GitMetricPlugin } from './metric.js';

/** Every plugin, as one discriminated union the registry can switch on. */
export type StrataPlugin =
  | LanguagePlugin
  | CommitConventionPlugin
  | GitMetricPlugin;
