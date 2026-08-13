import {
  defineLanguagePlugin,
  type GraphEdge,
  type GraphNode,
  type LanguageAnalysis,
  type RepoContext,
} from '@strata/sdk';
import { findCycles } from './cycles.js';
import { resolveLocal } from './resolve.js';
import { scan } from './scan.js';

/**
 * TypeScript / JavaScript language module.
 *
 * This starter builds a file-level import graph with a regex scan (`scan.ts`)
 * and finds import cycles via Tarjan's SCC (`cycles.ts`). It's intentionally
 * dependency-free so the scaffold runs out of the box; the real implementation
 * should parse with tree-sitter (or the TS compiler API) to get accurate module
 * resolution, unreferenced-export dead-code detection, and per-symbol edges.
 * The public shape it returns (LanguageAnalysis) will not change.
 */
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
