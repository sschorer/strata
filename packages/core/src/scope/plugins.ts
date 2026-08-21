import type { LoadedPlugin } from '../registry.js';
import type { NamedBy } from './errors.js';
import { requireLoaded } from './named.js';

/**
 * The plugins of one kind a run may call.
 *
 * `null` (or nothing) is every registered one — what the pipeline did before a
 * project could choose. A list is an **allow-list**: a plugin installed later
 * stands by until someone adds it, which is the point of writing the list down,
 * and an empty list runs none of them rather than all of them.
 *
 * An id that names no loaded plugin **fails the run**. "Run exactly these" and
 * "one of these is gone" are different situations, and quietly running the rest
 * would report an analysis that skipped a step as an analysis that found
 * nothing.
 */
export function enabledPlugins<T extends LoadedPlugin>(
  loaded: readonly T[],
  allowed: readonly string[] | null | undefined,
  by: NamedBy,
): T[] {
  requireLoaded(loaded, allowed, by);
  if (!allowed) return [...loaded];
  const wanted = new Set(allowed);
  return loaded.filter((entry) => wanted.has(entry.manifest.id));
}
