import { emptyStats } from './stats.js';
import type { AnalysisCache, CacheStats } from './types.js';

/**
 * A cache that caches nothing — used when caching is switched off or the
 * database could not be opened. Plugins can't tell the difference: `file()`
 * just calls `compute`.
 */
export function nullCache(): AnalysisCache {
  const stats: CacheStats = emptyStats();
  return {
    path: null,
    scope: () => ({
      file: (file, compute) => {
        stats.misses++;
        return compute(file);
      },
    }),
    getRun: () => {
      stats.runMisses++;
      return undefined;
    },
    setRun: () => {},
    flush: () => {},
    prune: () => {},
    stats: () => ({ ...stats }),
    clear: () => {},
    close: () => {},
  };
}
