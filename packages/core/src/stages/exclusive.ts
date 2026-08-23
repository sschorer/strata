import { UnchosenStageGroupError } from './errors.js';
import type { Stage } from './types.js';

/**
 * The stages left once every **exclusive group** has been settled to one
 * member.
 *
 * A group is a set of stages of which at most one may run — the conventions,
 * because a repository has one and "96% conforming" only means something
 * relative to one, and later the second rule engine or the second duplication
 * detector. Configuration names the active member; the rest stand by and are
 * not in the run at all, so the graph downstream sees exactly one producer and
 * a consumer can read that output type without asking who made it
 * (`docs/adr/0010`).
 *
 * A group with **one** member needs no choice: installing a single convention
 * is itself unambiguous, and requiring a config file to say so would make an
 * unconfigured workbench do nothing.
 *
 * A group with more than one member and **nothing named fails the run**. The
 * alternative is picking one — by load order, by name — and reporting a history
 * as conforming to a convention nobody chose, which no reader of the report can
 * tell from a history that conforms.
 *
 * `named` is every plugin id this run's configuration named, whatever setting
 * carried it. Ids rather than a group-to-choice map, because the core does not
 * know what any group *means*: a setting names a plugin, and a stage is in the
 * group its own manifest declared.
 */
export function exclusiveStages(
  stages: readonly Stage[],
  named: readonly string[],
): Stage[] {
  const chosen = new Set(named);
  const groups = new Map<string, Stage[]>();
  for (const stage of stages) {
    if (!stage.exclusive) continue;
    groups.set(stage.exclusive, [...(groups.get(stage.exclusive) ?? []), stage]);
  }

  const standingBy = new Set<string>();
  for (const [group, members] of groups) {
    if (members.length < 2) continue;
    const active = members.filter((stage) => chosen.has(stage.id));
    if (active.length !== 1) {
      throw new UnchosenStageGroupError(
        group,
        members.map((stage) => stage.id),
        active.map((stage) => stage.id),
      );
    }
    for (const stage of members) {
      if (stage.id !== active[0]!.id) standingBy.add(stage.id);
    }
  }

  return stages.filter((stage) => !standingBy.has(stage.id));
}
