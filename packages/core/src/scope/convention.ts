import type { CommitConventionPlugin } from '@strata/sdk';
import type { LoadedPlugin } from '../registry.js';

/** A loaded plugin already narrowed to the commit-convention kind. */
export type LoadedConvention = LoadedPlugin & {
  plugin: CommitConventionPlugin;
};

/**
 * The convention that parses this run's history **in the core**: the one the
 * project names, or — with nothing named — the first registered, which is what
 * the core did before a project could choose.
 *
 * Only the conventions that have not migrated are in here. One that has is a
 * stage, and the scheduler runs it: an **exclusive group** holds those to one,
 * and a group nobody chose from fails the run rather than reaching for load
 * order (`stages/exclusive.ts`). First-registered is what the kind has always
 * done, and it goes with the kind (`docs/adr/0011`).
 *
 * Still one active convention either way: two would parse the same commits into
 * two answers.
 *
 * Whether a named id is loaded at all is `requireLoaded`'s question, and it is
 * asked over *both* forms — a project naming the built-in convention is naming
 * a stage now, and that name must not read as missing.
 */
export function chosenConvention(
  loaded: readonly LoadedConvention[],
  id: string | null | undefined,
): CommitConventionPlugin | undefined {
  if (!id) return loaded[0]?.plugin;
  return loaded.find((entry) => entry.manifest.id === id)?.plugin;
}
