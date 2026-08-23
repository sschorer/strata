import type { StageTrouble } from './trouble';

/** What a stage that produced nothing is called where there is room for a verb. */
export function troubleVerb(trouble: StageTrouble): string {
  return trouble.status === 'failed' ? 'failed' : 'did not run';
}

/**
 * Several stages with nothing to show, in one line — what a stat card's hint
 * has room for, where a list of reasons does not fit.
 *
 * It says how they ended rather than which they were, because a card is a
 * number and a caption: the ids and the reasons belong on the screen that would
 * have shown the output, where there is room to print them.
 */
export function troubleLine(troubles: readonly StageTrouble[]): string {
  if (troubles.length === 0) return '';
  const count = troubles.length;
  const stages = `${count} ${count === 1 ? 'stage' : 'stages'}`;
  if (troubles.every((trouble) => trouble.status === 'failed')) {
    return `${stages} failed`;
  }
  if (troubles.every((trouble) => trouble.status === 'skipped')) {
    return `${stages} did not run`;
  }
  return `${stages} did not report`;
}
