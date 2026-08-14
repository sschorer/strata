import { join } from 'node:path';
import type { PackageManifest } from './manifest.js';
import { candidatePaths } from './resolve.js';

/** Run by a test runner, never imported — a root of the graph, not a leaf. */
const TEST_RE = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** `vite.config.ts`, `eslint.config.js` — loaded by a tool, by name. */
const CONFIG_RE = /(^|\/)[\w.-]*\.config\.[cm]?[jt]sx?$/;

/** Build output a published entry may point at, to be read back as source. */
const BUILD_DIRS = /(^|\/)(dist|build|lib|out)\//;

/**
 * The files an analysis should start from. Everything the import graph cannot
 * reach from one of these is dead — so a missed entry point is a false
 * accusation, and the rules below all err towards naming more of them.
 *
 * Three kinds count:
 *
 * 1. Anything a `package.json` publishes or invokes — `main`, `exports`, `bin`,
 *    and paths named in `scripts`.
 * 2. Tests. Nothing imports a spec file; a runner collects it by name.
 * 3. Tool configuration, for the same reason.
 *
 * A package that publishes nothing resolvable still gets its conventional
 * `src/index` as a root, so a library mid-scaffold is not reported as entirely
 * dead. When *no* entry point can be found at all the caller should skip
 * reachability altogether rather than declare the whole repository unreachable.
 *
 * These are heuristics standing in for configuration; the backlog's
 * per-project plugin settings are where a user will eventually name their own.
 */
export function entryPoints(
  paths: readonly string[],
  manifests: readonly PackageManifest[],
): Set<string> {
  const known = new Set(paths);
  const entries = new Set<string>();

  for (const path of paths) {
    if (TEST_RE.test(path) || CONFIG_RE.test(path)) entries.add(path);
  }

  for (const manifest of manifests) {
    let published = false;
    for (const value of manifest.entries) {
      const found = resolveEntry(manifest.dir, value, known);
      if (found) {
        entries.add(found);
        published = true;
      }
    }
    if (published) continue;

    for (const fallback of ['src/index', 'index']) {
      const found = resolveEntry(manifest.dir, fallback, known);
      if (found) {
        entries.add(found);
        break;
      }
    }
  }

  return entries;
}

/**
 * Map one manifest value onto a file in the run.
 *
 * A published entry names a build artefact — `./dist/index.js`, `./dist/x.d.ts`
 * — that no repository tracks. The value is therefore tried as written and
 * again with its build directory swapped for `src/`, letting `candidatePaths`
 * turn `.js` back into `.ts`.
 */
function resolveEntry(
  dir: string,
  value: string,
  known: ReadonlySet<string>,
): string | undefined {
  const rel = value.replace(/^\.\//, '');
  if (rel.startsWith('..')) return undefined;

  for (const variant of new Set([rel, rel.replace(BUILD_DIRS, '$1src/')])) {
    const base = join(dir, variant.replace(/\.d\.ts$/, '')).replaceAll('\\', '/');
    const found = candidatePaths(base).find((c) => known.has(c));
    if (found) return found;
  }
  return undefined;
}
