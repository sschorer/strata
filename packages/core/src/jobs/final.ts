import type { JobState } from './types.js';

/**
 * Whether a job has reached a state it will never leave.
 *
 * One predicate rather than a comparison written out wherever it is needed:
 * a reader that forgets one of the final states waits forever on a run that
 * is over — which is what an event stream held open past the last event, or a
 * poll loop asking about a finished job, actually looks like.
 */
export function isFinalState(state: JobState): boolean {
  return state === 'succeeded' || state === 'partial' || state === 'failed';
}
