import type { ProjectConfig } from './types.js';

/**
 * What a project analyses before anyone configures it: the checked-out
 * revision, the whole history, the whole repository, every registered plugin.
 * Exactly the behaviour `POST /analyze {root}` had before there was a config.
 */
export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  rev: 'HEAD',
  historyLimit: null,
  ignore: [],
  paths: [],
  languages: null,
  metrics: null,
  convention: null,
  rules: [],
};

/**
 * Fill a stored (sparse) config out to a whole one. Arrays are copied, so a
 * caller cannot mutate the defaults through the value it gets back.
 */
export function withDefaults(stored: Partial<ProjectConfig>): ProjectConfig {
  return {
    rev: stored.rev ?? DEFAULT_PROJECT_CONFIG.rev,
    historyLimit: stored.historyLimit ?? DEFAULT_PROJECT_CONFIG.historyLimit,
    ignore: [...(stored.ignore ?? DEFAULT_PROJECT_CONFIG.ignore)],
    paths: [...(stored.paths ?? DEFAULT_PROJECT_CONFIG.paths)],
    languages: stored.languages ? [...stored.languages] : null,
    metrics: stored.metrics ? [...stored.metrics] : null,
    convention: stored.convention ?? DEFAULT_PROJECT_CONFIG.convention,
    rules: (stored.rules ?? DEFAULT_PROJECT_CONFIG.rules).map((r) => ({
      ...r,
    })),
  };
}
