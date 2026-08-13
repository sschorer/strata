import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { PLUGIN_KINDS, SDK_VERSION, type PluginManifest } from '@strata/sdk';

/** The file that marks a directory as a plugin. */
export const MANIFEST_FILENAME = 'strata.plugin.json';

const REQUIRED_FIELDS = [
  'id',
  'name',
  'kind',
  'version',
  'sdk',
  'main',
] as const satisfies readonly (keyof PluginManifest)[];

/**
 * Read and validate a `strata.plugin.json`. Built-ins are ours, but a manifest
 * in the user plugins directory is hand-written by a third party, so every
 * field is checked here rather than trusted and cast.
 */
export async function readManifest(
  manifestPath: string,
): Promise<PluginManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (err) {
    throw new Error(`${manifestPath} is not readable JSON: ${message(err)}`, {
      cause: err,
    });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${manifestPath} must contain a JSON object.`);
  }

  const fields = parsed as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    const value = fields[field];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`${manifestPath} is missing a "${field}" string.`);
    }
  }

  const manifest = parsed as PluginManifest;
  if (!(PLUGIN_KINDS as readonly string[]).includes(manifest.kind)) {
    throw new Error(
      `Plugin "${manifest.id}" declares unknown kind "${manifest.kind}" ` +
        `(expected one of ${PLUGIN_KINDS.join(', ')}).`,
    );
  }
  if (major(manifest.sdk) !== major(SDK_VERSION)) {
    throw new Error(
      `Plugin "${manifest.id}" targets SDK ${manifest.sdk}, ` +
        `but this build ships SDK ${SDK_VERSION}.`,
    );
  }
  return manifest;
}

/**
 * Absolute path of the module to import for a manifest. `main` is resolved
 * against the plugin's own directory and must stay inside it — a drop-in
 * plugin does not get to point the loader at an arbitrary file on the host.
 */
export function resolveEntry(
  manifestPath: string,
  manifest: PluginManifest,
): string {
  const dir = dirname(resolve(manifestPath));
  const entry = resolve(dir, manifest.main);
  // Only a leading `..` *segment* escapes; a child named `..lib` does not.
  const rel = relative(dir, entry);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(
      `Plugin "${manifest.id}" has a "main" (${manifest.main}) outside its own directory.`,
    );
  }
  return entry;
}

function major(version: string): string {
  return version.split('.')[0] ?? version;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
