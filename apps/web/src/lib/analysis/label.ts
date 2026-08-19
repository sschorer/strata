import type { AnalysisProgress } from '$lib/api';

/** What each stage of the pipeline is called on screen. */
const STAGES: Record<AnalysisProgress['stage'], string> = {
  resolving: 'Resolving the revision',
  scanning: 'Listing tracked files',
  language: 'Analysing',
  history: 'Reading the commit history',
  metric: 'Computing',
  commits: 'Folding commit analytics',
  finished: 'Finishing up',
};

/**
 * One line for the step a run is on — `Analysing language-typescript`. A run
 * that has not reported anything yet is still waiting for a turn on the queue,
 * and saying so is better than an empty space where a state should be.
 */
export function progressLabel(progress: AnalysisProgress | null): string {
  if (!progress) return 'Queued';
  const stage = STAGES[progress.stage];
  return progress.detail ? `${stage} ${progress.detail}` : stage;
}

/**
 * How far along the run is, 0–1, or `null` while the server does not yet know
 * how many steps it holds — which is a bar that should not be drawn rather than
 * a bar drawn at nought.
 */
export function progressFraction(
  progress: AnalysisProgress | null,
): number | null {
  if (!progress?.total) return null;
  return Math.min(1, progress.completed / progress.total);
}
