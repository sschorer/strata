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

/**
 * An **exclusive group** with more than one member that configuration did not
 * settle to exactly one.
 *
 * Raised while the run is still being planned, for the same reason as the
 * error above: a configuration that cannot be turned into a run has to fail
 * while the failure still costs nothing and still has a name to give.
 *
 * Failing is the point of the group. Picking a member — the first loaded, the
 * first alphabetically — would report a history as conforming to a convention
 * nobody chose, and no reader of the report, screen or gate, can tell that from
 * a history that conforms (`docs/adr/0010`).
 */
export class UnchosenStageGroupError extends Error {
  constructor(
    /** The group, as every member's manifest spells it. */
    readonly group: string,
    /** Every stage in it, in declaration order — what configuration may name. */
    readonly members: readonly string[],
    /** The members configuration did name; none, or more than one. */
    readonly named: readonly string[],
  ) {
    super(
      named.length === 0
        ? `Stages ${quoted(members)} are all in the exclusive group ` +
            `"${group}", of which one runs. Name the one this project means; ` +
            `choosing for it would report a result nobody asked for as if it ` +
            `had been asked for.`
        : `Configuration names ${quoted(named)}, and they are all in the ` +
            `exclusive group "${group}", of which one runs. Name exactly one ` +
            `of ${quoted(members)}.`,
    );
    this.name = 'UnchosenStageGroupError';
  }
}

function quoted(ids: readonly string[]): string {
  return ids.map((id) => `"${id}"`).join(', ');
}
