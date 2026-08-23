import type { OutputType } from '@strata/sdk';
import { UnorderableStagesError } from './errors.js';
import type { Stage } from './types.js';

/**
 * The stages in an order that runs: every producer of an output type before
 * everyone consuming it.
 *
 * The edges come from the declarations and from nothing else — a stage names
 * output types, never other stages, so installing a second language module
 * feeds every consumer of a graph without a line of configuration anywhere
 * (`docs/adr/0010`).
 *
 * Ties keep the order the stages arrived in, so two runs over the same
 * workbench order the same way and a report's series do not shuffle between
 * them. A stage that consumes what it produces waits for the *others* that
 * produce it, not for itself.
 */
export function orderStages(stages: readonly Stage[]): Stage[] {
  const waiting = new Map<string, Set<string>>();
  for (const stage of stages) {
    const consumed = new Set<OutputType>(stage.consumes);
    waiting.set(
      stage.id,
      new Set(
        stages
          .filter((other) => other.id !== stage.id && consumed.has(other.produces))
          .map((other) => other.id),
      ),
    );
  }

  const ordered: Stage[] = [];
  const placed = new Set<string>();
  let remaining = [...stages];
  while (remaining.length > 0) {
    const ready = remaining.filter((stage) =>
      [...waiting.get(stage.id)!].every((id) => placed.has(id)),
    );
    if (ready.length === 0) {
      throw new UnorderableStagesError(
        remaining.map((stage) => stage.id),
        [...new Set(remaining.flatMap((stage) => stage.consumes))],
      );
    }
    for (const stage of ready) {
      ordered.push(stage);
      placed.add(stage.id);
    }
    remaining = remaining.filter((stage) => !placed.has(stage.id));
  }
  return ordered;
}
