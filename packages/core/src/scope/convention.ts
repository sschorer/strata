import type { CommitConventionPlugin } from '@strata/sdk';
import type { LoadedPlugin } from '../registry.js';

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
 * A named convention that is not loaded parses nothing rather than falling back
 * to whichever one happens to be first. A report claiming a history conforms to
 * a convention nobody asked for is worse than one that claims nothing about it.
 */
export function chosenConvention(
  loaded: readonly LoadedConvention[],
  id?: string | null,
): CommitConventionPlugin | undefined {
  if (!id) return loaded[0]?.plugin;
  return loaded.find((entry) => entry.manifest.id === id)?.plugin;
}
