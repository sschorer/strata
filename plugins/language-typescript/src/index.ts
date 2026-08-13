import { dirname, extname, join, normalize } from 'node:path';
import {
  defineLanguagePlugin,
  type GraphEdge,
  type GraphNode,
  type LanguageAnalysis,
  type RepoContext,
  type RepoFile,
} from '@strata/sdk';

/**
 * TypeScript / JavaScript language module.
 *
 * This starter builds a file-level import graph with a regex scan and finds
 * import cycles via Tarjan's SCC. It's intentionally dependency-free so the
 * scaffold runs out of the box; the real implementation should parse with
 * tree-sitter (or the TS compiler API) to get accurate module resolution,
 * unreferenced-export dead-code detection, and per-symbol edges. The public
 * shape it returns (LanguageAnalysis) will not change.
 */
const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;

/** What we extract from one file — cached per blob, so unchanged files are free. */
interface FileScan {
  loc: number;
  /** Relative import specifiers, unresolved (resolution needs the whole set). */
  specs: string[];
}

export default defineLanguagePlugin({
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  async analyze(ctx: RepoContext): Promise<LanguageAnalysis> {
    const byPath = new Map(ctx.files.map((f) => [f.path, f]));
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const file of ctx.files) {
      // Reading and scanning is the expensive half and depends only on the
      // file's contents; resolving specifiers depends on the whole file set,
      // so it stays out of the cached value.
      const { loc, specs } = await ctx.cache.file(file, scan);
      nodes.push({
        id: file.path,
        label: file.path,
        kind: 'file',
        meta: { loc },
      });

      for (const spec of specs) {
        const target = resolveLocal(file, spec, byPath);
        if (target) edges.push({ from: file.path, to: target, kind: 'import' });
      }
    }

    return {
      graph: { nodes, edges, cycles: findCycles(nodes, edges) },
      // TODO: implement via a real parser — export usage across the graph.
      deadCode: [],
      metrics: nodes.map((n) => ({
        path: n.id,
        loc: Number(n.meta?.loc ?? 0),
      })),
    };
  },
});

/** Read a file once and pull out everything that depends on its contents alone. */
async function scan(file: RepoFile): Promise<FileScan> {
  const text = await file.read();
  const specs: string[] = [];
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    if (spec?.startsWith('.')) specs.push(spec); // skip bare/pkg imports
  }
  return { loc: text.split('\n').length, specs };
}

/** Resolve a relative import specifier to a known file path. */
function resolveLocal(
  from: RepoFile,
  spec: string,
  byPath: Map<string, RepoFile>,
): string | undefined {
  const base = normalize(join(dirname(from.path), spec)).replaceAll('\\', '/');
  const candidates = extname(base)
    ? [base]
    : [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}/index.ts`,
        `${base}/index.tsx`,
      ];
  return candidates.find((c) => byPath.has(c));
}

/** Tarjan's strongly-connected-components; components with >1 node are cycles. */
function findCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) adj.get(e.from)?.push(e.to);

  let idx = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const strconnect = (v: string): void => {
    index.set(v, idx);
    low.set(v, idx);
    idx++;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!index.has(w)) {
        strconnectSafe(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }

    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) cycles.push(comp);
    }
  };
  // Bind so the recursive reference type-checks under strict mode.
  const strconnectSafe = strconnect;

  for (const n of nodes) if (!index.has(n.id)) strconnect(n.id);
  return cycles;
}
