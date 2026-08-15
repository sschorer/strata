import type { PluginRegistry } from '@strata/core';
import type { PluginKind } from '@strata/sdk';
import { httpError } from './http-error.js';

/**
 * Refuse a settings write that names a plugin this workbench has not loaded.
 * The screens only ever offer registered plugins, so a name that is not one is
 * a typo or a stale client — and stored silently it would look like a plugin
 * that is switched on but never runs.
 *
 * `null` (meaning "every registered plugin of this kind") is not a selection
 * and passes through.
 */
export function requireKnownPlugins(
  registry: PluginRegistry,
  kind: PluginKind,
  ids: string[] | string | null | undefined,
): void {
  if (ids === null || ids === undefined) return;

  const known = registry.loadedByKind(kind).map((l) => l.manifest.id);
  const unknown = (Array.isArray(ids) ? ids : [ids]).filter(
    (id) => !known.includes(id),
  );
  if (unknown.length === 0) return;

  throw httpError(
    400,
    `Unknown ${kind} plugin: ${unknown.map(quote).join(', ')}. ` +
      (known.length
        ? `Registered: ${known.map(quote).join(', ')}.`
        : `This workbench has no ${kind} plugin loaded.`),
  );
}

function quote(id: string): string {
  return `"${id}"`;
}
