import type { PluginManifest, StrataPlugin } from '@strata/sdk';

/**
 * Why a plugin's exported object contradicts what its manifest declared, or
 * `null` when the two agree.
 *
 * The manifest is what the core plans from, and it plans without importing
 * anything (`docs/adr/0010`) — so a declaration the module then disagrees with
 * makes the plan a lie: the core would hand a stage files its analyzer ignores,
 * or skip files it needed. Refused at load, exactly as a mismatched `kind` is,
 * because the alternative is a run that silently analyses the wrong set.
 *
 * Only what the exported object still says about itself can be cross-checked,
 * which today is a language plugin's extension list. As each declaration moves
 * off the object and into the manifest, its check here goes with it.
 */
export function pluginAgreementError(
  manifest: PluginManifest,
  plugin: StrataPlugin,
): string | null {
  const declared = manifest.filter?.extensions;
  if (!declared || plugin.kind !== 'language') return null;

  const exported = plugin.extensions;
  if (sorted(declared) !== sorted(exported)) {
    return (
      `declares filter extensions ${list(declared)} ` +
      `but exports ${list(exported)}`
    );
  }
  return null;
}

/** Order is not part of an extension list; membership is. */
function sorted(extensions: readonly string[]): string {
  return [...extensions].sort().join(',');
}

function list(extensions: readonly string[]): string {
  return extensions.length === 0
    ? 'none'
    : extensions.map((extension) => `"${extension}"`).join(', ');
}
