/** What reachability asks of a file: where its imports land. */
export interface FileEdges {
  path: string;
  uses: readonly { to: string }[];
  /** Resolved `export * from` targets — a barrel reaches what it re-exports. */
  stars: readonly string[];
}

/**
 * Files no entry point can reach, by walking the import graph forward.
 *
 * Reachability rather than "nothing imports this": three files that import each
 * other but sit outside the graph are all dead, and each of them has an
 * importer. The walk finds the island; a fan-in count would not.
 *
 * Entry points that are not part of the run are ignored, and an empty entry set
 * yields an empty result — with no roots, "unreachable" would mean "every
 * file", which is never a useful thing to report.
 */
export function unreachableFiles(
  files: readonly FileEdges[],
  entries: ReadonlySet<string>,
): Set<string> {
  if (entries.size === 0) return new Set();

  const byPath = new Map(files.map((f) => [f.path, f]));
  const reached = new Set<string>();
  const queue = [...entries].filter((path) => byPath.has(path));
  for (const path of queue) reached.add(path);

  for (let i = 0; i < queue.length; i++) {
    const file = byPath.get(queue[i]!);
    if (!file) continue;
    for (const to of [...file.uses.map((u) => u.to), ...file.stars]) {
      if (reached.has(to)) continue;
      reached.add(to);
      queue.push(to);
    }
  }

  return new Set(
    files.map((f) => f.path).filter((path) => !reached.has(path)),
  );
}
