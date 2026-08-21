import type { CommitConventionPlugin } from '@strata/sdk';
import type { LoadedPlugin } from '../registry.js';
import type { NamedBy } from './errors.js';
import { requireLoaded } from './named.js';

/** A loaded plugin already narrowed to the commit-convention kind. */
export type LoadedConvention = LoadedPlugin & {
  plugin: CommitConventionPlugin;
};

/**
 * The convention that parses this run's history: the one the project names,
 * or — with nothing named — the first registered, which is what the core did
 * before a project could choose. Still one active convention either way: two
 * would parse the same commits into two answers.
 *
 * A named convention that is not loaded **fails the run** rather than falling
 * back to whichever one happens to be first, or parsing nothing. Falling back
 * would claim a history conforms to a convention nobody asked for; parsing
 * nothing is worse still, because it renders as a history that conforms to
 * nothing, and no reader of the report — a screen, a gate — can tell the two
 * apart.
 *
 * Nothing named and nothing loaded is not a failure: the history is simply
 * unparsed, which is what a workbench with no convention plugin can honestly
 * say about it.
 */
export function chosenConvention(
  loaded: readonly LoadedConvention[],
  id: string | null | undefined,
  by: NamedBy,
): CommitConventionPlugin | undefined {
  requireLoaded(loaded, id, by);
  if (!id) return loaded[0]?.plugin;
  return loaded.find((entry) => entry.manifest.id === id)?.plugin;
}
