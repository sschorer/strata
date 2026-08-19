import { digest } from '../cache/digest.js';
import type { AnalyzeOptions } from '../types.js';

/**
 * A digest of everything that decides what a run does, so two requests that
 * would walk the same repository the same way are one job.
 *
 * This is what makes a double-clicked *Re-analyze* one analysis, and what lets
 * two browsers watching the same project follow the same run rather than
 * queueing a second identical one behind it.
 */
export function requestKey(options: AnalyzeOptions): string {
  return digest([
    options.root,
    options.rev ?? '',
    options.historyLimit,
    list(options.paths),
    list(options.ignore),
    list(options.languages),
    list(options.metrics),
    options.convention ?? '',
    String(options.cache),
  ]);
}

/** No path, glob or plugin id holds one, so two entries never run together. */
const SEPARATOR = '\u0000';

/**
 * One list of strings, digestibly. `null` ("every plugin", "the whole
 * repository") and `[]` ("none", "nothing") are opposite requests, so they must
 * not come out alike.
 */
function list(value?: readonly string[] | null): string {
  return value ? `[${value.join(SEPARATOR)}]` : '';
}
