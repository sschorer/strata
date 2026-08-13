import type { RawCommit } from './commit.js';
import type { RepoContext } from './repo.js';

/** One measured point, e.g. a file's hotspot score. */
export interface MetricPoint {
  /** Subject of the measurement: a file path, an author, a module. */
  subject: string;
  value: number;
  meta?: Record<string, number | string>;
}

export interface MetricSeries {
  /** e.g. "hotspots", "change-coupling", "code-age", "bus-factor". */
  id: string;
  label: string;
  unit?: string;
  points: MetricPoint[];
}

export interface GitMetricPlugin {
  kind: 'git-metric';
  id: string;
  /** Compute the series over the given history window. */
  compute(ctx: RepoContext, history: RawCommit[]): Promise<MetricSeries>;
}

export function defineGitMetricPlugin(
  p: Omit<GitMetricPlugin, 'kind'>,
): GitMetricPlugin {
  return { kind: 'git-metric', ...p };
}
