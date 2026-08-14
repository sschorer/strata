import type { DeadCodeFinding } from '@strata/sdk';
import type { ExportSite } from './exports.js';

/** What export analysis asks of a file: what it offers, and what it takes. */
export interface FileSymbols {
  path: string;
  exports: readonly ExportSite[];
  uses: readonly {
    to: string;
    names: readonly string[];
    namespace: boolean;
  }[];
  /** Resolved `export * from` targets. */
  stars: readonly string[];
}

/**
 * Exported names nothing else in the repository asks for.
 *
 * A name is used when another file imports it *by that name*, when a file takes
 * the whole module (`import * as`, `require`, a dynamic `import()`) — nothing
 * there says which properties are read — or when it reaches an entry point. An
 * entry point's exports are the package's public API: they are consumed from
 * outside the repository, so they are seeded as used, and so are the names a
 * public barrel forwards with `export *`.
 *
 * Local use does not count. `export function f` that only this file calls is
 * still an export nobody wants — dropping the keyword is the fix, and that is
 * exactly what the finding says.
 *
 * `skip` names files already reported whole (unreachable ones); listing their
 * every export again would bury the one finding that matters.
 */
export function unreferencedExports(
  files: readonly FileSymbols[],
  entries: ReadonlySet<string>,
  skip: ReadonlySet<string>,
): DeadCodeFinding[] {
  const owned = new Map<string, Set<string>>();
  const stars = new Map<string, readonly string[]>();
  for (const file of files) {
    owned.set(file.path, new Set(file.exports.map((e) => e.name)));
    stars.set(file.path, file.stars);
  }

  const used = new Map<string, Set<string>>();
  const consumed = new Set<string>();

  /**
   * Mark `name` used in `path`. A barrel that does not declare the name itself
   * forwards the demand to whatever it re-exports — that is the only way a
   * name can be imported from a file that never mentions it. `seen` stops a
   * cyclic set of barrels from looping.
   */
  const use = (path: string, name: string, seen = new Set<string>()): void => {
    if (seen.has(path)) return;
    seen.add(path);
    if (owned.get(path)?.has(name)) {
      let names = used.get(path);
      if (!names) used.set(path, (names = new Set()));
      names.add(name);
      return;
    }
    for (const target of stars.get(path) ?? []) use(target, name, seen);
  };

  /** Mark every name a module offers — directly or through a star — as used. */
  const useAll = (path: string): void => {
    if (consumed.has(path)) return;
    consumed.add(path);
    for (const name of owned.get(path) ?? []) use(path, name);
    for (const target of stars.get(path) ?? []) useAll(target);
  };

  for (const entry of entries) useAll(entry);
  for (const file of files) {
    for (const site of file.uses) {
      if (site.namespace) useAll(site.to);
      else for (const name of site.names) use(site.to, name);
    }
  }

  const findings: DeadCodeFinding[] = [];
  for (const file of files) {
    if (skip.has(file.path)) continue;
    const names = used.get(file.path);
    const reported = new Set<string>();
    for (const site of file.exports) {
      if (names?.has(site.name) || reported.has(site.name)) continue;
      reported.add(site.name);
      findings.push({
        path: file.path,
        symbol: site.name,
        line: site.line,
        reason: 'unreferenced-export',
      });
    }
  }
  return findings;
}
