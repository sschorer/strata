# Module: `@strata/plugin-language-typescript` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **language**.

## 1. Purpose & Goals

Per-language analysis for **TypeScript / JavaScript**: build a file-level import
dependency graph, detect import cycles, measure each file (LOC, cyclomatic
complexity, nesting depth, duplication), and report dead code (unreferenced
exports, unreachable files, unused dependencies). The reference language plugin
— Angular and other TS-based analyzers build on its shape.

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
| `scan.ts` | Everything derivable from one file → `{ loc, imports, exports, stars, complexity, nesting, fingerprint }`, cached per blob via `ctx.cache`. |
| `strip.ts` | The lexer: `stripNonCode` blanks comments, literals and regexes; `stripComments` blanks comments only. |
| `imports.ts` | Parse `import` / `require` / `import()` → specifier + the names taken. |
| `exports.ts` | Parse `export` → the names offered, their lines, and re-exports. |
| `clause.ts` | Split a braced `{ a, b as c }` list — shared by both parsers. |
| `complexity.ts` | McCabe cyclomatic complexity — 1 + decision points. |
| `nesting.ts` | Deepest nesting of control-flow blocks. |
| `fingerprint.ts` | Window hashes of one file's code — the per-file half of clone detection. |
| `duplication.ts` | Compare fingerprints across files → duplicated share per file. |
| `resolve.ts` | Map a relative specifier to a known file (`./x.js` → `x.ts`, `/index.ts`, …); bare imports ignored. |
| `graph.ts` | Resolved imports → one `import` edge per file pair. |
| `cycles.ts` | Tarjan's SCC; components with > 1 node are cycles. |
| `deadcode.ts` | Run the three dead-code passes and merge them into one sorted list. |
| `entries.ts` | Which files are roots: published entries, npm scripts, tests, tool config. |
| `unreachable.ts` | Walk the graph from the entries; what is left is unreachable. |
| `unreferenced.ts` | Exported names no other file asks for, followed through barrels. |
| `dependencies.ts` | Declared `dependencies` no file in the package imports. |
| `manifest.ts` | Parse one `package.json` → deps (with lines) + entry values. |
| `workspace.ts` | Read every tracked `package.json` at the revision, via `ctx.git`. |

## 5. Runtime

`analyze(ctx)` iterates the matched files, collects each file's scan and
resolves its specifiers into nodes/edges. It then runs the cross-file passes —
duplication, and the three dead-code passes over the resolved graph plus the
workspace manifests — and returns `{ graph, deadCode, metrics }`.

Dead code is three questions against one graph:

| Reason | Question |
|--------|----------|
| `unreachable-file` | Can any entry point reach this file at all? |
| `unreferenced-export` | Does any other file ask for this name? |
| `unused-dependency` | Does any file in the package import this dependency? |

## 6. Decisions

- **Regex now, tree-sitter next** — exact resolution, path aliases and
  per-symbol edges come with the parser upgrade; the returned shape won't change.
- **Specifiers are read from comment-stripped text** — a commented-out import is
  not an edge, but the specifier itself is a live string literal and has to
  survive, so the import/export parsers run on `stripComments`, not the raw file
  and not `stripNonCode`.
- **`./x.js` resolves to `x.ts`** — a NodeNext codebase imports the output and
  ships the input. Without that mapping a correctly written ESM + TypeScript
  project resolves to no edges at all, and everything downstream of the graph
  (cycles, reachability) is silently empty.
- **Dead code hangs off entry points** — "unreachable" is meaningless without a
  root, so entries are inferred (what a `package.json` publishes or invokes,
  tests, tool config) and a repository with none gets no graph findings rather
  than a report accusing every file. Reachability, not fan-in: an island of
  files importing each other is dead although each one has an importer.
- **An entry's exports are public API** — seeded as used, including names a
  public barrel forwards with `export *`, or every package's index would read as
  entirely dead.
- **Local use does not count** — an export only this file uses is still an
  export nobody wants; dropping the keyword is the fix, which is what the
  finding says.
- **`dependencies` only, and never `@types/*`** — dev dependencies are mostly
  things nobody imports on purpose (compiler, test runner, lint plugins), so
  checking them would produce noise rather than dead code.
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
- **Risk:** a file that *generates* code — an `export` inside a template literal
  — registers phantom exports, because literals survive `stripComments`.
  **Mitigation:** rare, and gone with the parser upgrade.
- **Risk:** an inferred entry point that is wrong accuses live files of being
  dead. A file reached only through a path alias, a bundler config, or a
  Makefile has no edge the scan can see. **Mitigation:** the rules err towards
  more roots; user-declared entry points arrive with the per-project plugin
  settings on the backlog.
- **Risk:** a dependency used only from a file this plugin never sees (a `.vue`
  template, a JSON config) reads as unused.
- **Debt:** the core keys the cached run on the *matched* files alone, so
  editing only a `package.json` reuses the previous run and its
  `unused-dependency` findings until a source file changes.
- **Debt:** `export const a = 1, b = 2` reports only `a`, and a destructured
  `export const { a } = x` reports nothing.
- **Debt:** complexity counts TypeScript conditional types (`T extends U ? …`)
  as branches, and nesting only sees braced blocks.
