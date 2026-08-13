# Module: `@strata/plugin-language-typescript` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **language**.

## 1. Purpose & Goals

Per-language analysis for **TypeScript / JavaScript**: build a file-level import
dependency graph, detect import cycles, and report basic metrics. The reference
language plugin — Angular and other TS-based analyzers build on its shape.

## 2. Constraints

- Emits the standard `LanguageAnalysis` shape so the UI renders it for free.
- Ships **dependency-free** today (regex scan) so the scaffold runs out of the box.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the core's language step, routed by extensions
  `ts,tsx,js,jsx,mjs,cjs`.
- **Manifest:** `strata.plugin.json` (`kind: language`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The plugin: assemble nodes/edges, return `LanguageAnalysis`. |
| `scan.ts` | Regex scan of one file → `{ loc, specs }`, cached per blob via `ctx.cache`. |
| `resolve.ts` | Map a relative specifier to a known file (`.ts`, `/index.ts`, …); bare imports ignored. |
| `cycles.ts` | Tarjan's SCC; components with > 1 node are cycles. |

## 5. Runtime

`analyze(ctx)` iterates the matched files, builds nodes/edges, computes cycles,
returns `{ graph, deadCode, metrics }`.

## 6. Decisions

- **Regex now, tree-sitter next** — accurate module resolution, dead-code via
  real export-usage, and per-symbol edges come with the parser upgrade; the
  returned shape won't change.
- **Cache the scan, not the resolution** — specifier resolution depends on the
  whole file set, so only the contents-derived half is cacheable per blob.

## 7. Quality & Risks

- **Risk:** regex misses dynamic imports / path aliases → missing or false edges.
  **Mitigation:** replace with tree-sitter / the TS compiler API (backlog).
- **Debt:** `deadCode` is a stub until real parsing lands.
