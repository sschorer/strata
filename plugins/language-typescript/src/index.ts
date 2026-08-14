import {
  defineLanguagePlugin,
  type CodeMetric,
  type GraphEdge,
  type GraphNode,
  type LanguageAnalysis,
  type RepoContext,
} from '@strata/sdk';
import { findCycles } from './cycles.js';
import { duplicationByPath } from './duplication.js';
import { resolveLocal } from './resolve.js';
import { scan, type FileScan } from './scan.js';

/**
 * TypeScript / JavaScript language module.
 *
 * This starter builds a file-level import graph with a regex scan (`scan.ts`)
 * and finds import cycles via Tarjan's SCC (`cycles.ts`). It's intentionally
 * dependency-free so the scaffold runs out of the box; the real implementation
 * should parse with tree-sitter (or the TS compiler API) to get accurate module
 * resolution, unreferenced-export dead-code detection, and per-symbol edges.
 * The public shape it returns (LanguageAnalysis) will not change.
 *
 * Metrics are real, not placeholders: complexity and nesting are counted over
 * code with comments and literals blanked out (`strip.ts`), and duplication
 * compares window hashes across every file (`duplication.ts`).
 */
export default defineLanguagePlugin({
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  async analyze(ctx: RepoContext): Promise<LanguageAnalysis> {
    const byPath = new Map(ctx.files.map((f) => [f.path, f]));
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const scans = new Map<string, FileScan>();

    for (const file of ctx.files) {
      // Reading and scanning is the expensive half and depends only on the
      // file's contents; resolving specifiers and matching fingerprints depend
      // on the whole file set, so they stay out of the cached value.
      const scanned = await ctx.cache.file(file, scan);
      scans.set(file.path, scanned);
      nodes.push({
        id: file.path,
        label: file.path,
        kind: 'file',
        meta: { loc: scanned.loc },
      });

      for (const spec of scanned.specs) {
        const target = resolveLocal(file, spec, byPath);
        if (target) edges.push({ from: file.path, to: target, kind: 'import' });
      }
    }

    const duplication = duplicationByPath(
      [...scans].map(([path, s]) => ({ path, ...s.fingerprint })),
    );
    const metrics: CodeMetric[] = [...scans].map(([path, s]) => ({
      path,
      loc: s.loc,
      complexity: s.complexity,
      nesting: s.nesting,
      duplication: duplication.get(path) ?? 0,
    }));

    return {
      graph: { nodes, edges, cycles: findCycles(nodes, edges) },
      // TODO: implement via a real parser — export usage across the graph.
      deadCode: [],
      metrics,
    };
  },
});
