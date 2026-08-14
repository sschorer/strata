import { dirname } from 'node:path';
import { parseJsonc } from './jsonc.js';

/** One `tsconfig.json`, reduced to what module resolution asks of it. */
export interface TsconfigFile {
  /** Repo-relative path to the config itself. */
  path: string;
  /** The directory it sits in; `''` for one at the repository root. */
  dir: string;
  /** Configs it extends, as written — relative paths only, in order. */
  extends: string[];
  /** `compilerOptions.baseUrl`, as written, when it sets one. */
  baseUrl?: string;
  /** `compilerOptions.paths`, as written, when it sets any. */
  paths?: Record<string, string[]>;
}

/** Parse a tsconfig. Returns nothing when it is not a usable JSON object. */
export function parseTsconfig(
  path: string,
  text: string,
): TsconfigFile | undefined {
  const json = parseJsonc(text);
  if (!isRecord(json)) return undefined;

  const dir = dirname(path);
  const options = isRecord(json['compilerOptions']) ? json['compilerOptions'] : {};
  const baseUrl = options['baseUrl'];
  const paths = readPaths(options['paths']);

  return {
    path,
    dir: dir === '.' ? '' : dir,
    // TypeScript 5 allows a list; a single string is the common form.
    extends: [json['extends']].flat().filter((v) => typeof v === 'string'),
    ...(typeof baseUrl === 'string' ? { baseUrl } : {}),
    ...(paths ? { paths } : {}),
  };
}

/**
 * `paths` as declared: pattern → targets. Anything that is not a list of
 * strings is dropped rather than guessed at — a malformed entry would resolve
 * imports to files nobody named.
 */
function readPaths(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;

  const paths: Record<string, string[]> = {};
  for (const [pattern, targets] of Object.entries(value)) {
    if (!Array.isArray(targets)) continue;
    const strings = targets.filter((t): t is string => typeof t === 'string');
    if (strings.length > 0) paths[pattern] = strings;
  }
  return Object.keys(paths).length > 0 ? paths : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
