# Module: `@strata/plugin-language-typescript` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **language**.

## 1. Purpose & Goals

Per-language analysis for **TypeScript / JavaScript**: build a file-level import
dependency graph, detect import cycles, and measure each file (LOC, cyclomatic
complexity, nesting depth, duplication). The reference language plugin — Angular
and other TS-based analyzers build on its shape.

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
| `index.ts` | The plugin: assemble nodes/edges/metrics, return `LanguageAnalysis`. |
| `scan.ts` | Everything derivable from one file → `{ loc, specs, complexity, nesting, fingerprint }`, cached per blob via `ctx.cache`. |
| `strip.ts` | The lexer: `stripNonCode` blanks comments, literals and regexes; `stripComments` blanks comments only. |
| `complexity.ts` | McCabe cyclomatic complexity — 1 + decision points. |
| `nesting.ts` | Deepest nesting of control-flow blocks. |
| `fingerprint.ts` | Window hashes of one file's code — the per-file half of clone detection. |
| `duplication.ts` | Compare fingerprints across files → duplicated share per file. |
| `resolve.ts` | Map a relative specifier to a known file (`.ts`, `/index.ts`, …); bare imports ignored. |
| `cycles.ts` | Tarjan's SCC; components with > 1 node are cycles. |

## 5. Runtime

`analyze(ctx)` iterates the matched files, builds nodes/edges and collects each
file's scan, then runs the one cross-file pass (duplication) and returns
`{ graph, deadCode, metrics }`.

## 6. Decisions

- **Regex now, tree-sitter next** — accurate module resolution, dead-code via
  real export-usage, and per-symbol edges come with the parser upgrade; the
  returned shape won't change.
- **Cache the scan, not the resolution** — specifier resolution and fingerprint
  matching depend on the whole file set, so only the contents-derived half is
  cacheable per blob.
- **Lex before counting** — metrics measure stripped text, never raw source, so
  an `if` in a doc comment or a brace in a string cannot skew them.
- **Strip differently per metric** — complexity and nesting count syntax, so
  literals go; duplication compares code, so literals stay (otherwise every
  barrel of `export * from './x.js'` reads as a wholesale clone).
- **Whole-file metrics** — the file is the unit the graph, the hotspot map and
  the dead-code table already address; per-function numbers wait for the parser.

## 7. Quality & Risks

- **Risk:** regex misses dynamic imports / path aliases → missing or false edges.
  **Mitigation:** replace with tree-sitter / the TS compiler API (backlog).
- **Risk:** the lexer's `/` heuristic can read a regex after `)` as division.
  **Mitigation:** it only mis-blanks a literal, never a control keyword; gone
  with the parser upgrade.
- **Debt:** `deadCode` is a stub until real parsing lands.
- **Debt:** complexity counts TypeScript conditional types (`T extends U ? …`)
  as branches, and nesting only sees braced blocks.
