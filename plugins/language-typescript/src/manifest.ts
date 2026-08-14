import { dirname } from 'node:path';

/** A declared dependency, and where it is declared. */
export interface DeclaredDependency {
  name: string;
  /** 1-based line in the package.json, when it could be located. */
  line?: number;
}

/** One `package.json`, reduced to what dead-code analysis asks of it. */
export interface PackageManifest {
  /** Repo-relative path to the package.json itself. */
  path: string;
  /** The directory it governs; `''` for one at the repository root. */
  dir: string;
  /** `dependencies` only — see `dependencies.ts` for why dev deps are out. */
  dependencies: DeclaredDependency[];
  /** Values of every field naming a file: `main`, `exports`, `bin`, `scripts`. */
  entries: string[];
}

/** Fields whose values point at a file that is, by definition, reachable. */
const ENTRY_FIELDS = ['main', 'module', 'browser', 'types', 'typings', 'bin', 'exports'];

/** A file path as it appears inside an npm script (`node scripts/build.mjs`). */
const SCRIPT_PATH_RE = /(?:^|\s)([\w./@-]+\.[cm]?[jt]sx?)(?=\s|$)/g;

/** Parse a package.json. Returns nothing when it is not a usable JSON object. */
export function parseManifest(
  path: string,
  text: string,
): PackageManifest | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isRecord(json)) return undefined;

  const dir = dirname(path);
  return {
    path,
    dir: dir === '.' ? '' : dir,
    dependencies: declaredDependencies(json, text),
    entries: [
      ...ENTRY_FIELDS.flatMap((field) => filePaths(json[field])),
      ...scriptPaths(json['scripts']),
    ],
  };
}

/**
 * Names under `dependencies`, each with the line it sits on so the UI can link
 * straight at it. The line is found by reading the text rather than the parsed
 * object, because JSON.parse throws positions away.
 */
function declaredDependencies(
  json: Record<string, unknown>,
  text: string,
): DeclaredDependency[] {
  const deps = json['dependencies'];
  if (!isRecord(deps)) return [];

  const lines = text.split('\n');
  const start = lines.findIndex((line) =>
    line.trim().startsWith('"dependencies"'),
  );

  return Object.keys(deps).map((name) => {
    const line = lineOfKey(lines, start, name);
    return line === undefined ? { name } : { name, line };
  });
}

/** The line declaring `name`, searched only inside the dependencies block. */
function lineOfKey(
  lines: string[],
  start: number,
  name: string,
): number | undefined {
  if (start === -1) return undefined;
  for (let i = start + 1; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith('}')) return undefined; // block closed
    if (trimmed.startsWith(`"${name}"`)) return i + 1;
  }
  return undefined;
}

/** Every string in an entry field — `exports` and `bin` nest maps of them. */
function filePaths(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (isRecord(value)) return Object.values(value).flatMap(filePaths);
  return [];
}

/** File paths mentioned by npm scripts: `"build": "node scripts/build.mjs"`. */
function scriptPaths(scripts: unknown): string[] {
  if (!isRecord(scripts)) return [];
  return Object.values(scripts)
    .filter((command): command is string => typeof command === 'string')
    .flatMap((command) => [...command.matchAll(SCRIPT_PATH_RE)].map((m) => m[1]!));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
