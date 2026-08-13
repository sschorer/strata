import type { PluginKind } from '@strata/sdk';

/**
 * What the orchestrator dereferences on a plugin of each kind. The manifest
 * only says what a module claims to be; this is the module delivering it.
 */
const REQUIRED: Record<PluginKind, readonly Member[]> = {
  language: [
    ['extensions', 'array'],
    ['analyze', 'function'],
  ],
  'commit-convention': [['parse', 'function']],
  'git-metric': [['compute', 'function']],
  'ai-provider': [
    ['listModels', 'function'],
    ['chat', 'function'],
  ],
};

type Member = readonly [name: string, type: 'array' | 'function'];

/**
 * Why `value` is not a usable plugin of `kind`, or `null` if it is. Checked at
 * load time on purpose: a half-written plugin that passes its manifest would
 * otherwise register fine and throw in the middle of an analysis, taking the
 * whole run down with it.
 */
export function pluginShapeError(
  kind: PluginKind,
  value: object,
): string | null {
  const members = value as Record<string, unknown>;
  for (const [name, type] of REQUIRED[kind]) {
    const member = members[name];
    const ok =
      type === 'array' ? Array.isArray(member) : typeof member === 'function';
    if (!ok) {
      return type === 'array'
        ? `is missing the "${name}" array every ${kind} plugin must expose`
        : `is missing ${name}(), which every ${kind} plugin must implement`;
    }
  }
  return null;
}
