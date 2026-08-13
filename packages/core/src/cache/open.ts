import { resolve } from 'node:path';
import { createConsoleLogger } from '../logger.js';
import { nullCache } from './null.js';
import { SqliteAnalysisCache } from './sqlite.js';
import type { AnalysisCache, CacheOptions } from './types.js';

const DISABLED_VALUES = new Set(['0', 'off', 'false', 'no']);

/**
 * Open the cache. Never throws: an unwritable location (read-only container,
 * missing permissions) degrades to a pass-through cache and a warning, because
 * a broken cache must not fail an analysis.
 */
export function openAnalysisCache(opts: CacheOptions = {}): AnalysisCache {
  const log = opts.log ?? createConsoleLogger('strata:cache');
  if (!cacheEnabled(opts.enabled)) return nullCache();

  const file =
    opts.path ??
    resolve(opts.dir ?? process.env.STRATA_CACHE_DIR ?? '.strata', 'cache.db');
  try {
    return new SqliteAnalysisCache(file, opts.maxAgeDays ?? 30, log);
  } catch (err) {
    log.warn(`disabled — could not open ${file}: ${(err as Error).message}`);
    return nullCache();
  }
}

function cacheEnabled(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  const env = process.env.STRATA_CACHE?.trim().toLowerCase();
  return !(env && DISABLED_VALUES.has(env));
}
