/**
 * A set of stages the core cannot order: each one waits, through however many
 * hops, on an output type that only a stage downstream of it produces.
 *
 * Raised while the run is still being planned, before anything is read — a
 * configuration that cannot be satisfied is a validation error, not a crash
 * halfway through an analysis (`docs/adr/0010`). It is also all the core can
 * say: which stage is "at fault" in a knot is not knowable, so the message
 * names every stage still in it.
 */
export class UnorderableStagesError extends Error {
  constructor(
    /** The stages left when nothing could be placed, in declaration order. */
    readonly stages: readonly string[],
    /** What each of them is still waiting for. */
    readonly waitingFor: readonly string[],
  ) {
    super(
      `Stages ${quoted(stages)} cannot be ordered: each one consumes an ` +
        `output type (${waitingFor.join(', ')}) that only another of them ` +
        `produces. A stage graph has to be acyclic to be run at all.`,
    );
    this.name = 'UnorderableStagesError';
  }
}

function quoted(ids: readonly string[]): string {
  return ids.map((id) => `"${id}"`).join(', ');
}
