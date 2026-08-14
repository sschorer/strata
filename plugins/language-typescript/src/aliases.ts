import { join, normalize } from 'node:path';
import type { TsconfigFile } from './tsconfig.js';

/** One `paths` entry: `@app/*` → prefix `@app/`, suffix `''`, one wildcard. */
interface AliasPattern {
  prefix: string;
  suffix: string;
  /** Does the pattern end in a wildcard match, or must the specifier be exact? */
  wildcard: boolean;
  /** Repo-relative targets, `*` still in place, in the order to try them. */
  targets: string[];
}

/** The alias rules one `tsconfig.json` lays down over its directory. */
export interface AliasScope {
  /** The directory the config governs; `''` at the repository root. */
  dir: string;
  /** Repo-relative `baseUrl`, when the config sets one. */
  baseUrl?: string;
  patterns: AliasPattern[];
}

/** Config filenames a project's source is actually compiled with. */
const GOVERNING = new Set(['tsconfig.json', 'jsconfig.json']);

/**
 * The alias scopes a repository declares, nearest-first.
 *
 * A specifier like `@app/user` is not a package: it is whatever
 * `compilerOptions.paths` says it is, and without reading that a plugin sees an
 * unresolvable import where the project sees a local file — no edge, no
 * reachability, and every file behind the alias reported as dead.
 *
 * Only `tsconfig.json` and `jsconfig.json` open a scope. A `tsconfig.build.json`
 * next to them is a variant for one command, not the rules the sources are
 * written against; it is still read, because a governing config may extend it.
 */
export function aliasScopes(configs: readonly TsconfigFile[]): AliasScope[] {
  const byPath = new Map(configs.map((c) => [c.path, c]));

  return configs
    .filter((config) => GOVERNING.has(config.path.split('/').at(-1) ?? ''))
    .map((config) => scopeOf(config, byPath))
    .filter((scope) => scope.baseUrl !== undefined || scope.patterns.length > 0)
    // Longest directory first, so the nearest config wins.
    .sort((a, b) => b.dir.length - a.dir.length);
}

/**
 * Where a specifier could live according to `scopes`, most specific first.
 *
 * Only the nearest config applies: TypeScript compiles a file against one
 * config, so borrowing a sibling package's aliases would resolve imports the
 * compiler rejects.
 */
export function aliasBases(
  scopes: readonly AliasScope[],
  from: string,
  spec: string,
): string[] {
  const scope = scopes.find((s) => s.dir === '' || from.startsWith(`${s.dir}/`));
  if (!scope) return [];

  const bases = matched(scope.patterns, spec);
  // `baseUrl` alone makes every non-relative specifier resolvable against it —
  // the older way to write an alias, and still how many projects import `src/x`.
  if (scope.baseUrl !== undefined) bases.push(repoPath(join(scope.baseUrl, spec)));
  return bases;
}

/** Targets of the one pattern that fits `spec` best, wildcard substituted. */
function matched(patterns: readonly AliasPattern[], spec: string): string[] {
  let best: AliasPattern | undefined;
  for (const pattern of patterns) {
    if (!fits(pattern, spec)) continue;
    // TypeScript picks a single pattern — the longest prefix that matches —
    // and then tries all of its targets in order.
    if (!best || pattern.prefix.length > best.prefix.length) best = pattern;
  }
  if (!best) return [];

  const star = spec.slice(best.prefix.length, spec.length - best.suffix.length);
  return best.targets.map((target) => target.replace('*', star));
}

function fits(pattern: AliasPattern, spec: string): boolean {
  if (!pattern.wildcard) return spec === pattern.prefix;
  return (
    spec.length >= pattern.prefix.length + pattern.suffix.length &&
    spec.startsWith(pattern.prefix) &&
    spec.endsWith(pattern.suffix)
  );
}

function scopeOf(
  config: TsconfigFile,
  byPath: ReadonlyMap<string, TsconfigFile>,
): AliasScope {
  const { baseUrl, paths } = inherited(config, byPath, new Set());
  const base = baseUrl ? repoPath(join(baseUrl.dir, baseUrl.value)) : undefined;

  return {
    dir: config.dir,
    ...(base === undefined ? {} : { baseUrl: base }),
    // Targets are relative to `baseUrl` when there is one, and otherwise to the
    // config that declares them — which is how TypeScript reads them, and why
    // both have to remember where they came from.
    patterns: patternsOf(paths?.value ?? {}, base ?? paths?.dir ?? config.dir),
  };
}

function patternsOf(
  paths: Record<string, string[]>,
  base: string,
): AliasPattern[] {
  return Object.entries(paths).map(([pattern, targets]) => {
    const star = pattern.indexOf('*');
    return {
      prefix: star === -1 ? pattern : pattern.slice(0, star),
      suffix: star === -1 ? '' : pattern.slice(star + 1),
      wildcard: star !== -1,
      targets: targets.map((target) => repoPath(join(base, target))),
    };
  });
}

/** What a config sets, or the nearest config it extends does. */
interface Inherited {
  baseUrl?: { value: string; dir: string };
  paths?: { value: Record<string, string[]>; dir: string };
}

function inherited(
  config: TsconfigFile,
  byPath: ReadonlyMap<string, TsconfigFile>,
  seen: Set<string>,
): Inherited {
  if (seen.has(config.path)) return {}; // a config that extends itself
  seen.add(config.path);

  let options: Inherited = {};
  for (const ref of config.extends) {
    const base = extended(config.dir, ref, byPath);
    // A base outside the repository — `@tsconfig/node24` — cannot be read here.
    if (base) options = { ...options, ...inherited(base, byPath, seen) };
  }

  // Whatever the config says itself overrides what it inherited. The two
  // options travel together with the directory they were written in.
  if (config.baseUrl !== undefined) {
    options.baseUrl = { value: config.baseUrl, dir: config.dir };
  }
  if (config.paths) options.paths = { value: config.paths, dir: config.dir };
  return options;
}

/** The config `extends` names, tried the way TypeScript tries it. */
function extended(
  dir: string,
  ref: string,
  byPath: ReadonlyMap<string, TsconfigFile>,
): TsconfigFile | undefined {
  if (!ref.startsWith('.')) return undefined;
  const base = repoPath(join(dir, ref));
  const candidates = ref.endsWith('.json')
    ? [base]
    : [`${base}.json`, `${base}/tsconfig.json`];
  for (const candidate of candidates) {
    const found = byPath.get(candidate);
    if (found) return found;
  }
  return undefined;
}

/** A repo-relative path: forward slashes, no `./`, `''` for the root itself. */
function repoPath(path: string): string {
  return normalize(path)
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\.$/, '');
}
