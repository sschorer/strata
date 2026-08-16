import type { LoadedPlugin } from '../registry.js';

/**
 * The plugins of one kind a run may call.
 *
 * `null` (or nothing) is every registered one — what the pipeline did before a
 * project could choose. A list is an **allow-list**: a plugin installed later
 * stands by until someone adds it, which is the point of writing the list down,
 * and an empty list runs none of them rather than all of them.
 *
 * Ids that name no loaded plugin select nothing. A stored config outliving the
 * plugin it names is expected — the API checks ids as they are written, not
 * forever — and the honest reading of "run exactly these" is that an absent one
 * does not run.
 */
export function enabledPlugins<T extends LoadedPlugin>(
  loaded: readonly T[],
  allowed?: readonly string[] | null,
): T[] {
  if (!allowed) return [...loaded];
  const wanted = new Set(allowed);
  return loaded.filter((entry) => wanted.has(entry.manifest.id));
}
