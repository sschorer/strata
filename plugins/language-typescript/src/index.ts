import {
  defineLanguagePlugin,
  type CodeMetric,
  type GraphNode,
  type LanguageAnalysis,
  type RepoContext,
} from '@strata/sdk';
import { findCycles } from './cycles.js';
import { findDeadCode, type AnalysedFile } from './deadcode.js';
import { duplicationByPath } from './duplication.js';
import { importEdges } from './graph.js';
import { resolveImports } from './resolve.js';
import { scan, type FileScan } from './scan.js';
import { readManifests } from './workspace.js';

/**
 * TypeScript / JavaScript language module.
 *
 * Builds a file-level import graph with a regex scan over lexed source
 * (`scan.ts`), finds import cycles via Tarjan's SCC (`cycles.ts`), measures
 * every file (`complexity.ts`, `nesting.ts`, `duplication.ts`) and reports dead
 * code — unreferenced exports, unreachable files and unused dependencies
 * (`deadcode.ts`). It is intentionally dependency-free so the scaffold runs out
 * of the box; the real implementation should parse with tree-sitter (or the TS
 * compiler API) for exact resolution, path aliases and per-symbol edges. The
 * public shape it returns (LanguageAnalysis) will not change.
 */
export default defineLanguagePlugin({
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  async analyze(ctx: RepoContext): Promise<LanguageAnalysis> {
    const byPath = new Map(ctx.files.map((f) => [f.path, f]));
    const nodes: GraphNode[] = [];
    const scans = new Map<string, FileScan>();
    const analysed: AnalysedFile[] = [];

    for (const file of ctx.files) {
      // Reading and scanning is the expensive half and depends only on the
      // file's contents; resolving specifiers, matching fingerprints and
      // deciding what is dead all depend on the whole file set, so they stay
      // out of the cached value.
      const scanned = await ctx.cache.file(file, scan);
      scans.set(file.path, scanned);
      nodes.push({
        id: file.path,
        label: file.path,
        kind: 'file',
        meta: { loc: scanned.loc },
      });

      const { uses, stars } = resolveImports(file, scanned, byPath);
      analysed.push({
        path: file.path,
        exports: scanned.exports,
        specs: scanned.imports.map((i) => i.spec),
        uses,
        stars,
      });
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

    const edges = importEdges(analysed);
    return {
      graph: { nodes, edges, cycles: findCycles(nodes, edges) },
      deadCode: findDeadCode(analysed, await readManifests(ctx)),
      metrics,
    };
  },
});
