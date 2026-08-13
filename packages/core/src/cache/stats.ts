import type { CacheStats } from './types.js';

export function emptyStats(): CacheStats {
  return { hits: 0, misses: 0, runHits: 0, runMisses: 0, writes: 0 };
}

/**
 * Counters live as long as the cache does, so a single run's numbers are the
 * difference between two readings.
 */
export function deltaStats(before: CacheStats, after: CacheStats): CacheStats {
  return {
    hits: after.hits - before.hits,
    misses: after.misses - before.misses,
    runHits: after.runHits - before.runHits,
    runMisses: after.runMisses - before.runMisses,
    writes: after.writes - before.writes,
  };
}
