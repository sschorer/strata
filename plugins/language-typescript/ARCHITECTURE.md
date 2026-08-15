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
- Parsing is **tree-sitter**, loaded as WebAssembly, so installing the plugin
  never needs a compiler or a platform-specific build.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`, `web-tree-sitter`, `@vscode/tree-sitter-wasm`
  (the pre-built `typescript` and `tsx` grammars).
- **Consumed by:** the core's language step, routed by extensions
  `ts,tsx,mts,cts,js,jsx,mjs,cjs`.
- **Manifest:** `strata.plugin.json` (`kind: language`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The plugin: assemble nodes/edges/metrics, summarise the graph, return `LanguageAnalysis`. |
| `parser.ts` | Load the grammars once; parse one file and lend out its syntax tree. |
| `scan.ts` | Everything derivable from one file → `{ loc, imports, exports, stars, complexity, nesting, fingerprint }`, cached per blob via `ctx.cache`. |
| `imports.ts` | Read `import` / `require` / `import()` off the tree → specifier + the names taken. |
| `exports.ts` | Read `export` off the tree → the names offered, their lines, and re-exports. |
| `packages.ts` | The workspace's own packages: name → directory, and a specifier → its source. |
| `literal.ts` | The value of a static string node — or nothing, when only the runtime knows it. |
| `comments.ts` | Blank every comment, keeping the offsets — what duplication compares. |
| `complexity.ts` | McCabe cyclomatic complexity — 1 + decision-point nodes. |
| `nesting.ts` | Deepest nesting of control-flow structures. |
| `fingerprint.ts` | Window hashes of one file's code — the per-file half of clone detection. |
| `duplication.ts` | Compare fingerprints across files → duplicated share per file. |
| `resolve.ts` | Map a specifier to a known file (`./x.js` → `x.ts`, `/index.ts`, an alias, …). |
| `aliases.ts` | `paths`/`baseUrl` of the nearest `tsconfig.json` → where a bare specifier may live. |
| `tsconfig.ts` | Parse one config → `extends`, `baseUrl`, `paths`. |
| `jsonc.ts` | JSON with comments and trailing commas — the dialect a tsconfig is written in. |
| `graph.ts` | Resolved imports → one `import` edge per file pair. |
| `cycles.ts` | Tarjan's SCC; components with > 1 node are cycles. |
| `deadcode.ts` | Run the three dead-code passes and merge them into one sorted list. |
| `entries.ts` | Which files are roots: published entries, npm scripts, tests, tool config. |
| `unreachable.ts` | Walk the graph from the entries; what is left is unreachable. |
| `unreferenced.ts` | Exported names no other file asks for, followed through barrels. |
| `dependencies.ts` | Declared `dependencies` no file in the package imports. |
| `manifest.ts` | Parse one `package.json` → deps (with lines) + entry values. |
| `workspace.ts` | The tracked `package.json` files, parsed. |
| `tsconfigs.ts` | The tracked `tsconfig.json` files, parsed. |
| `tracked.ts` | List and read files at the analysed revision, via `ctx.git`. |

## 5. Runtime

`analyze(ctx)` first reads what git tracks but `ctx.files` does not — the
manifests and the TypeScript configs — because the alias scopes have to exist
before the first specifier is resolved. It then iterates the matched files,
collects each file's scan (one parse per file) and resolves its specifiers into
nodes/edges. Finally it runs the cross-file passes — duplication, and the three
dead-code passes over the resolved graph plus the workspace manifests — and
returns `{ graph, summary, deadCode, metrics }`.

The summary is the graph's headline numbers — nodes, edges, cycles, the files
those cycles hold, and the busiest node in each direction. `summariseGraph` from
the SDK counts them, here, once: the graph is repository-sized, the numbers
never change after the run, and a reader that recounts them is a second
definition of the same thing waiting to disagree.

Dead code is three questions against one graph:

| Reason | Question |
|--------|----------|
| `unreachable-file` | Can any entry point reach this file at all? |
| `unreferenced-export` | Does any other file ask for this name? |
| `unused-dependency` | Does any file in the package import this dependency? |

## 6. Decisions

- **tree-sitter, as WebAssembly** — a syntax tree ends the whole class of
  regex mistakes (a commented-out import, an `export` inside a template
  literal, a `case` in a string) and finds a dynamic `import()` wherever it is
  called. The grammars ship pre-built as `.wasm` rather than as native bindings
  because a plugin must install in a slim container without `node-gyp`.
- **Two grammars, chosen by extension** — `.ts`/`.mts`/`.cts` parse with the
  JSX-free grammar, where `<T>x` is a type assertion; everything else parses
  with `tsx`, where it opens an element.
- **The tree never outlives the scan** — it lives in the WebAssembly heap, which
  the JavaScript garbage collector cannot reach, so `parser.ts` lends the root
  out for the length of one call and releases it afterwards.
- **Only the module's top level exports** — a name declared inside `namespace N`
  is reached as `N.x` and is not an export any importer can name.
- **Aliases come from the project's own `tsconfig.json`** — `@app/user` is not a
  package but whatever `compilerOptions.paths` says, resolved with the nearest
  config's rules (`extends` chain included). Without it, every file behind an
  alias reads as unreachable.
- **A workspace package is an edge, not a dependency** — in a monorepo,
  `packages/core` imports `@strata/sdk`, which Node resolves through a
  `node_modules` symlink to build output that is not in the repository. Read
  literally, every package is an island and the graph shows nothing crossing
  between them. So the workspace manifests are read for the names the repository
  publishes (`packages.ts`) and the specifier resolves to that package's source.
  The built entry is deliberately not followed: an edge into a `dist/` artefact
  is not one a reader can act on.
- **Imports that leave the repository are not edges** — a third-party package is
  a fact about the `package.json`, which the dependency pass already reports;
  putting `svelte` in the graph adds a node nobody navigates to.
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
- **Count nodes, not tokens** — a decision point is an `if_statement` or a
  short-circuiting operator, so a `case` in a string, an `&&` in a comment and
  the `?` of an optional parameter cannot inflate the number, and a conditional
  *type* branches the type checker rather than the program.
- **Blank comments for duplication, keep literals** — two files that differ only
  in a header comment are copies; two lines that differ only in a string
  (`export * from './a.js'` and `'./b.js'`) are not, or every barrel in the
  repository would read as a wholesale clone.
- **Whole-file metrics** — the file is the unit the graph, the hotspot map and
  the dead-code table already address; per-function numbers are the next step
  now that the tree makes them cheap.

## 7. Quality & Risks

- **Risk:** a specifier resolved by a scheme this plugin does not read — a
  bundler's own aliases, `package.json` `imports` (`#internal/x`), a workspace
  package name — draws no edge, so its target can read as unreachable.
  **Mitigation:** `tsconfig.json` aliases cover the common case; the rest waits
  for per-project plugin settings (backlog).
- **Risk:** an inferred entry point that is wrong accuses live files of being
  dead. A file reached only through a bundler config or a Makefile has no edge
  the scan can see. **Mitigation:** the rules err towards more roots;
  user-declared entry points arrive with the per-project plugin settings.
- **Risk:** a dependency used only from a file this plugin never sees (a `.vue`
  template, a JSON config) reads as unused.
- **Debt:** the core keys the cached run on the *matched* files alone, so
  editing only a `package.json` or a `tsconfig.json` reuses the previous run
  until a source file changes.
- **Debt:** the grammars are pinned by `@vscode/tree-sitter-wasm`, which ships
  every grammar VS Code uses (~22 MB installed) for the two this plugin loads.
- **Debt:** a checked-in bundle is parsed like any other file — ~0.8 s and a few
  hundred MB for 2 MB of minified JavaScript, paid once per blob thanks to the
  cache. The backlog's ignore-globs are the real fix.
- **Debt:** dead code is still name-based, not per-symbol: importing *anything*
  from a module keeps the names it re-exports with `export *` alive, and a
  namespace import keeps all of them.
