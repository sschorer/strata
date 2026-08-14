import type { RepoContext } from '@strata/sdk';
import { readTracked } from './tracked.js';
import { parseTsconfig, type TsconfigFile } from './tsconfig.js';

/** `tsconfig.json`, `tsconfig.build.json`, `jsconfig.json` — and nothing else. */
const CONFIG_RE = /(^|\/)(ts|js)config(\.[\w-]+)?\.json$/;

/**
 * Read every TypeScript config among `paths` at the analysed revision.
 *
 * Variants (`tsconfig.build.json`) are read alongside the governing configs
 * because `extends` can point at them, and an alias declared in the base is the
 * one the sources are actually written against.
 */
export async function readTsconfigs(
  ctx: RepoContext,
  paths: readonly string[],
): Promise<TsconfigFile[]> {
  const configs: TsconfigFile[] = [];

  for (const path of paths) {
    if (!CONFIG_RE.test(path) || path.includes('node_modules/')) continue;
    const text = await readTracked(ctx, path);
    if (text === undefined) continue;
    const config = parseTsconfig(path, text);
    if (config) configs.push(config);
  }

  return configs;
}
