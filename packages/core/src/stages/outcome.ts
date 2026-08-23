import type { StageEntry } from '@strata/sdk';

/**
 * How a run as a whole ended, once every stage in it has.
 *
 * `partial` is the shape a pipeline anyone can add to has to be able to report:
 * a stage threw, everything downstream of it went with it, and the rest of the
 * run is still here and still worth reading (`docs/adr/0015`). It is a run, it
 * is recorded, and it never passes a gate.
 */
export type RunStatus = 'ok' | 'partial' | 'failed';

/**
 * A run's status, read off what its stages did.
 *
 * A run that lost nothing is `ok` — including one where every stage was skipped
 * for having no file to work on, because nothing failed and nothing is missing
 * from the report that the repository could have filled.
 *
 * A run that lost something and kept something is `partial`. One that lost
 * something and kept **nothing** is `failed`: there is no half of it to read,
 * so calling it a run that partly worked would be the same flattery as an empty
 * output with the trouble recorded elsewhere.
 */
export function runStatus(entries: Record<string, StageEntry>): RunStatus {
  const stages = Object.values(entries);
  if (!stages.some((entry) => entry.status === 'failed')) return 'ok';
  return stages.some((entry) => entry.status === 'ok') ? 'partial' : 'failed';
}
