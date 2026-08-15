import {
  defineLanguagePlugin,
  type CodeMetric,
  type GraphNode,
  type LanguageAnalysis,
  type RepoContext,
} from '@strata/sdk';
import { aliasScopes } from './aliases.js';
import { findCycles } from './cycles.js';
import { findDeadCode, type AnalysedFile } from './deadcode.js';
import { duplicationByPath } from './duplication.js';
import { importEdges } from './graph.js';
import { workspacePackages } from './packages.js';
import { resolveImports } from './resolve.js';
import { scan, type FileScan } from './scan.js';
import { trackedPaths } from './tracked.js';
import { readTsconfigs } from './tsconfigs.js';
import { readManifests } from './workspace.js';

/**
 * TypeScript / JavaScript language module.
 *
 * Builds a file-level import graph from a tree-sitter parse of every file
 * (`parser.ts`, `scan.ts`), resolving specifiers through the project's own
 * `tsconfig.json` aliases (`aliases.ts`), finds import cycles via Tarjan's SCC
 * (`cycles.ts`), measures every file (`complexity.ts`, `nesting.ts`,
 * `duplication.ts`) and reports dead code — unreferenced exports, unreachable
 * files and unused dependencies (`deadcode.ts`). The reference language plugin:
 * Angular and other TS-based analyzers build on the shape it returns.
 */
export default defineLanguagePlugin({
  // `.mts`/`.cts` are the module-explicit TypeScript extensions the resolver
  // has always been willing to resolve *to*; leaving them unclaimed meant the
  // files themselves were never analysed.
  extensions: ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'],
  async analyze(ctx: RepoContext): Promise<LanguageAnalysis> {
    const byPath = new Map(ctx.files.map((f) => [f.path, f]));
    const nodes: GraphNode[] = [];
    const scans = new Map<string, FileScan>();
    const analysed: AnalysedFile[] = [];

    // Both come from git rather than `ctx.files`, and the aliases have to be
    // known before the first specifier is resolved.
    const tracked = await trackedPaths(ctx);
    const manifests = await readManifests(ctx, tracked);
    const scopes = aliasScopes(await readTsconfigs(ctx, tracked));
    // How this repository names its own packages: `@strata/sdk` is an edge
    // into `packages/sdk`, not a third-party dependency.
    const packages = workspacePackages(manifests);

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

      const { uses, stars } = resolveImports(
        file,
        scanned,
        byPath,
        scopes,
        packages,
      );
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
      deadCode: findDeadCode(analysed, manifests),
      metrics,
    };
  },
});
