# Module: `@strata/core` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **orchestrator**. Ingests a git repository, holds the plugin registry, builds
the immutable `RepoContext`, and drives the analysis pipeline that fans work out
to plugins. This is the only module that knows about all three plugin kinds.

It also owns what the workbench has to remember between runs: the incremental
cache, the **project registry** — which repositories are registered, and what
the last analysis of each one found — each project's **configuration**, what an
analysis of it is supposed to do, and the **app settings**, how the workbench
itself behaves.

## 2. Constraints

- Reads git by shelling out to the `git` binary (must be on PATH).
- Hands plugins nothing but a `RepoContext` — the core injects no fs or network
  APIs. That is an interface contract, **not a sandbox**: a plugin runs
  in-process and can import `node:fs` itself (see §7).
- Pure in → out per file, so results stay cacheable/incremental.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk` (contracts), `git` CLI.
- **Consumed by:** `@strata/server` (and `scripts/analyze.mjs`).
- **Public API:** `Strata.analyze(opts, onProgress?) → AnalysisReport`,
  `AnalysisQueue` (+ `inlineRunner()`), `PluginRegistry`, `discoverPlugins()` /
  `userPluginsDir()`, `openProjectStore()`, `openSettingsStore()`, `gitUtil`
  helpers.

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | Barrel — the package's public surface, no logic. |
| `strata.ts` | The `Strata` orchestrator. |
| `types.ts` | `AnalyzeOptions`, `StrataOptions`, `AnalysisReport`, `RunReport`, `CacheReport`. |
| `graph/fold.ts` | `crossLanguageGraph()` — every language's graph as the one graph, summary and ordered cycles a report carries. |
| `graph/merge.ts` | `mergedGraph()` — the union of the per-language graphs, deduplicated. |
| `graph/packages.ts` | `packageNodes()` — a node for each end of an edge that left the analysed file set. |
| `graph/types.ts` | `CrossLanguageGraph`. |
| `commits/analyse.ts` | `analyseCommits()` — the parsed log folded into `CommitAnalytics`. |
| `commits/buckets.ts` | `bucketBy()` — counts per type / per scope, biggest first. |
| `commits/weeks.ts` | `weeklyActivity()` — commits per Monday-started week (UTC). |
| `commits/types.ts` | `CommitAnalytics`, `CommitBucket`, `CommitWeek`. |
| `logger.ts` | `createConsoleLogger(scope)` — what `RepoContext.log` gets. |
| `registry.ts` | `PluginRegistry` — load plugins, contain load failures, `byKind()` / `loadedByKind()`. |
| `manifest.ts` | `readManifest()` / `resolveEntry()` — validate a `strata.plugin.json` and its entry path. |
| `plugin-shape.ts` | `pluginShapeError()` — does the module implement the kind it claims? |
| `retired-kinds.ts` | `retiredKindError()` — a kind Strata dropped, and what took over its job. |
| `summarise.ts` | `summarised()` — fill in a language result's graph summary when the plugin (or its cached run) predates the field. |
| `progress/types.ts` | `AnalysisProgress`, `AnalysisStage`, `ProgressListener` — what a run says about itself while it runs. |
| `progress/tracker.ts` | `ProgressTracker` — counts a run's steps so the pipeline only has to name them. |
| `jobs/types.ts` | `AnalysisJob`, `AnalysisJobSummary`, `AnalysisRunner`, `JobState`, queue options. |
| `jobs/queue.ts` | `AnalysisQueue` — one run at a time, identical requests joined, every job watchable and collectable afterwards. |
| `jobs/key.ts` | `requestKey()` — the digest that decides which requests are the same run. |
| `jobs/inline.ts` | `inlineRunner()` — run in the calling thread (CI, scripts, tests). |
| `jobs/summary.ts` | `jobSummary()` — a job without its report, for a list. |
| `scope/glob.ts` | `globMatcher()` — the ignore/analyse globs compiled to one predicate over repo-relative paths. |
| `scope/files.ts` | `scopedFiles()` — the tracked files narrowed to a project's `paths` minus its `ignore`. |
| `scope/extensions.ts` | `claimedFiles()` — the files one language plugin claims, by extension. |
| `scope/plugins.ts` | `enabledPlugins()` — the plugins of one kind a run may call. |
| `scope/convention.ts` | `chosenConvention()` — which `commit-convention` plugin parses this history. |
| `discover.ts` | `discoverPlugins(dir)` — the manifests installed in a plugins directory. |
| `plugins-dir.ts` | `userPluginsDir()` — where drop-in plugins live (`STRATA_PLUGINS_DIR`). |
| `git/exec.ts` | Run a read-only git command. |
| `git/rev.ts` | `resolveRev` — revision → sha. |
| `git/branch.ts` | `branchAt` — the branch a revision names, if any. |
| `git/files.ts` | `listFiles` — tracked files with blob shas. |
| `git/history.ts` | `history` — structured commit records. |
| `git/churn.ts` | `churn` — per-file change counts. |
| `git/repo.ts` | `toplevel` — the working-tree root a path belongs to. |
| `cache/types.ts` | `AnalysisCache`, `CacheOptions`, `CacheStats`. |
| `cache/open.ts` | `openAnalysisCache()` — resolve location, degrade safely. |
| `cache/sqlite.ts` | The SQLite implementation. |
| `cache/null.ts` | The pass-through implementation. |
| `cache/schema.ts` | Tables, pragmas, schema migration. |
| `cache/keys.ts`, `cache/digest.ts`, `cache/json.ts`, `cache/stats.ts` | Entry keys, run-key digests, JSON round-trip, counter arithmetic. |
| `projects/types.ts` | `Project`, `ProjectAnalysis`, `ProjectStore`, options. |
| `projects/open.ts` | `openProjectStore()` — resolve location, degrade safely. |
| `projects/sqlite.ts` | The persistent registry (`projects.db`). |
| `projects/memory.ts` | The process-lifetime registry (fallback, tests). |
| `projects/schema.ts` | Table, pragmas, schema stamp. |
| `projects/id.ts`, `projects/input.ts`, `projects/errors.ts` | Slugged ids, normalised input, `DuplicateRootError`. |
| `browse/list.ts` | `listDirectory()` — the subdirectories of one directory, each marked whether it is a git working tree. Names only, never a file. |
| `browse/types.ts` | `DirectoryListing`, `DirectoryEntry`, `BrowseOptions`. |
| `roots/config.ts` | `configuredRoots()` / `resolveRoots()` — where Strata may reach (`STRATA_ROOTS`, else `$HOME`), as configured and as it is on disk. |
| `roots/within.ts` | `withinRoots()` — whether a resolved path is a root or inside one. |
| `roots/allowed.ts` | `allowedDirectory()` — resolve a requested path and confine it to the roots, or refuse. |
| `roots/errors.ts` | `RootDeniedError`, `NoSuchDirectoryError`. |
| `config/types.ts` | `ProjectConfig`, `ProjectConfigPatch`, `ArchitectureRule`. |
| `config/defaults.ts` | `DEFAULT_PROJECT_CONFIG` + `withDefaults()` — fill a stored config out. |
| `config/patch.ts` | `applyPatch()` — merge, normalise, refuse what cannot be stored. |
| `config/errors.ts` | `InvalidConfigError`. |
| `settings/types.ts` | `AppSettings` and its sections, `SettingsStore`, options. |
| `settings/defaults.ts` | `DEFAULT_APP_SETTINGS` + `withAppDefaults()`. |
| `settings/patch.ts` | `applyAppPatch()` — merge two levels deep, normalise, refuse. |
| `settings/open.ts` | `openSettingsStore()` — resolve location, degrade safely. |
| `settings/sqlite.ts` | The persistent settings (`settings.db`). |
| `settings/memory.ts` | The process-lifetime settings (fallback, tests). |
| `settings/schema.ts` | Table, pragmas, schema stamp. |
| `settings/errors.ts` | `InvalidSettingsError`. |
| `ai/types.ts` | `ProviderRuntime`, `ChatMessage`, `ChatOptions` — the internal call surface a subprocess runtime will implement. Not in the barrel and not in the SDK: a provider is configuration, and no run may call it. |

## 5. Runtime

`analyze()`:
1. `resolveRev` → sha; `branchAt` → branch (or none); `listFiles` → `RepoFile[]`
   (blob-keyed), narrowed once by `scopedFiles()` to the project's analyse
   paths minus its ignore globs.
2. Build `RepoContext`, one `cache` scope per plugin.
3. Route files to the enabled `language` plugins by extension — skipping any
   plugin whose input digest already has a stored result.
4. Stream `history`; run the enabled `git-metric` plugins (same skip).
5. Parse commits with the project's `commit-convention` plugin — the first
   registered when it names none — then fold the log into `CommitAnalytics`
   (per type, per scope, conformance, breaking changes, weekly activity).
6. Fold every language's graph into one `CrossLanguageGraph` — deduplicated,
   with a node for each package an import left for, each cycle ordered into a
   path and the whole thing counted once.
7. Merge into `AnalysisReport`, with the run's own metadata (`RunReport`:
   branch, file count, duration, finished-at) beside the resolved `rev`.

Each of those steps is announced to `onProgress`, if a caller passed one. The
plan — how many steps the run holds — is worked out between 2 and 3, once the
file list says which plugins actually take part; the two steps before that
report a total of `0` rather than a number that would move.

`AnalysisQueue` is the layer a server puts in front of all of it. `submit()`
returns a job straight away and runs it behind whatever is already going;
`settled(id)` is the report when there is one, `watch(id, …)` is every change
until then, and `clearCache()` takes its turn in the same line. Where the run
actually happens is the `AnalysisRunner`'s business — `inlineRunner()` runs it
here, and `@strata/server` runs it on a worker thread.

`openProjectStore()` is independent of a run: it opens `projects.db` once, and
the entries it holds are read on request (`list` / `get` / `findByRoot` /
`config`) and written when a project is added, renamed, re-pointed, configured,
analysed or removed.

A project's config is stored **sparsely** — only the fields someone set — and
`withDefaults()` fills it out on the way to a caller. `setConfig()` merges a
patch through `applyPatch()`, which normalises (trims, drops blank rows,
collapses duplicates) and throws `InvalidConfigError` on a value that cannot
mean anything.

`openSettingsStore()` is the app-scoped twin, and works the same way one scope
up: one row in `settings.db`, stored sparsely, filled out by
`withAppDefaults()`, merged by `applyAppPatch()`. Its patch is two levels deep
— a section left out keeps everything it had, a field left out inside a named
section keeps its value — because each section is one settings screen.

## 6. Decisions

- **Extension-based routing** for language plugins (simple, fast).
- **Third-party plugins are drop-in, and nothing about them is trusted** — one
  directory per plugin under `userPluginsDir()`, every manifest field validated,
  `main` confined to the plugin's own directory, the export checked both for the
  kind it claims and for the members that kind must implement — a plugin that
  would throw mid-analysis never registers. Built-ins load first and ids are
  first-one-wins, so a drop-in cannot shadow one. A plugin that fails any check
  is recorded in
  `registry.failures()` rather than thrown: a broken third-party plugin must
  cost only itself, not the process.
- **One active commit convention**, the project's choice, and the
  first-registered one when it has made none — two conventions would parse the
  same commits into two answers. A project naming a convention that is no longer
  installed parses **nothing**, with a warning, rather than falling back to
  whichever plugin happens to be first: a report claiming a history conforms to
  a convention nobody asked for is worse than one that claims nothing.
- **A project's config is turned into behaviour in one place** (`scope/`), at
  the top of `analyze()`, and never inside a plugin. Scope narrows the file list
  before any plugin sees it, so the plugins, the report's file count and every
  cache key below describe the same set — and a plugin left to re-apply the
  globs itself could disagree with all three, or forget. The enabled-plugin
  lists are **allow-lists**: nothing named is every plugin (what an unconfigured
  project asks for), a list is exactly those, and an empty list is none of them.
- **Globs are matched, not shelled out.** `*` and `?` stay inside a path
  segment, `**` crosses them and may stand for no directory at all, and a
  pattern covers the tree under what it names — so `dist` is the build directory
  without anyone having to know to write it as a wildcard. The lists are typed
  by hand into a chip list, and the forgiving reading is the one that matches
  what the writer meant.
- **The aggregates are folded in the core, not by each reader.** A plugin says
  what one commit means; how many `feat` commits there were is a question every
  screen, card and gate asks, and three of them counting it three ways is three
  quietly disagreeing definitions. A window no convention parsed still reports
  its activity and claims nothing about conformance — "unjudged" is not the
  same as "non-conforming". Weeks are bucketed Monday-to-Monday in **UTC**: an
  author's timezone is whatever their laptop said at the time, so anything else
  would move a commit between columns depending on who ran the analysis.
- **What more than one language's output implies is folded here too.** The
  merged dependency graph, its summary and each cycle as an ordered path are in
  the report rather than in whoever reads it: a screen, a CI gate and a second
  API client would otherwise each merge, each count and each arrange the same
  knots ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)). The summary
  counts the analysed nodes only — the synthesised package nodes are the far
  ends of imports that left the file set, not files this run looked at.
- **The run times itself** — duration covers everything the caller waited for,
  cache open included, and `finishedAt` is stamped where the run ends. A client
  measuring its own round-trip would be measuring the network too. A revision
  that names no branch (detached HEAD, sha, tag) reports `null` rather than
  inventing one.
- **A run reports itself in the pipeline's own stages**, not as a percentage.
  The steps a reader is shown are the steps `analyze()` takes, a plugin that
  claims none of this repository's file types is never counted as one, and the
  total is `0` — an honest unknown — until the file list makes it knowable. A
  bar that jumps backwards when the plan firms up would be worse than no bar.
  A run nobody watches pays nothing: the tracker's methods are no-ops without a
  listener.
- **The queue owns *when*, a runner owns *where*.** Analyses are serialised
  because they are CPU-bound and share one cache, so two at once would be
  slower than two in a row and would fight over the same database. Identical
  requests are one job, so a double-clicked *Re-analyze* and two browsers on
  the same project follow the same run. And a job outlives the request that
  asked for it, which is what lets a caller be handed an id now and the report
  later. None of that says anything about threads — which is why the core can
  keep no opinion on them and the server can hold one.
- **A finished job is kept for a while and not forever** (the last 20). A
  browser that reconnects a moment after a run ended still has to be able to
  collect the report; a workbench that remembered every run of every day would
  be holding megabytes of report per entry for nobody.
- **Blob sha on every file**, so the cache keys on content, not on paths or
  timestamps.
- **Two cache levels** — a plugin whose entire input digest is unchanged is
  skipped outright; otherwise it re-reads only the blobs that changed, through
  `RepoContext.cache`. Graph-shaped results are not per-file, so the per-file
  level alone would not make a rerun free.
- **The plugin version is part of every key**, so shipping a new plugin build
  invalidates exactly that plugin's entries.
- **`node:sqlite`** over `better-sqlite3` — Node ≥ 24 is already a constraint,
  and the cache stays dependency- and native-build-free.
- **The cache never fails an analysis** — a database that cannot be opened,
  read or written degrades to a pass-through with one warning per run. A failed
  write costs a recomputation on the next run, nothing more.
- **The registry is its own database** (`projects.db`, beside `cache.db`).
  Everything in the cache is derived and disposable — it is pruned, cleared by
  `DELETE /cache`, and wiped outright on a schema bump. None of that may cost
  someone their list of projects, so the two never share a file, and a registry
  written by a newer Strata is left alone rather than opened.
- **The registry does not swallow its failures**, unlike the cache. Opening it
  does degrade — to an in-memory registry and a warning, so the workbench still
  runs — but a *write* that fails throws, because an "Add project" that reports
  success and stores nothing loses something no rerun brings back.
- **A project is keyed on the repository, not the path someone typed** — the
  root is resolved to its git working-tree root (`gitUtil.toplevel`) and stored
  absolute, so a subdirectory, a trailing slash and a symlink are one project
  and not four. Ids are slugs assigned once, so renaming cannot break a link.
- **Config is stored sparsely and defaulted on read**, rather than written out
  in full when a project is registered. A default that moves in a later release
  then reaches every project that never overrode it, and "never set" stays
  distinguishable from "set to today's default".
- **Identity and configuration are separate** — display name and root live on
  the registry entry (the root has to stay unique across projects, which only
  the registry can promise); everything about what an analysis *does* lives in
  the config. Deleting a project deletes both, so an id handed out again never
  inherits the last holder's settings.
- **App settings are their own database too** (`settings.db`, beside
  `projects.db`). They are one row about the workbench, not a list that grows
  per project, and the registry's schema is the one that keeps changing as
  project features land — a migration there must not be able to cost somebody
  their provider configuration. Same durability rules as the registry: opening
  degrades to memory and a warning, a write that fails throws.
- **A settings section is a settings screen**, and the sections are stored as
  one JSON value rather than a column per field. Adding a screen is then not a
  migration, and a `PATCH` that names one section says exactly what the screen
  it came from can promise.

- **What may be reached is configuration, not process permissions** (`roots/`).
  One allow-list — `STRATA_ROOTS`, else the server user's home — covers every
  path that arrives from outside, browsed or analysed alike, because they are
  the same question asked by different endpoints. A path is resolved through
  its symlinks *before* it is checked and the resolved path is what the caller
  gets back, so a link cannot step outside a root and what runs is what was
  checked. A path that cannot be resolved is refused as *outside* unless it
  would lie inside a root anyway, so a refusal never doubles as an existence
  check.
- **The confinement is applied at the boundary, not inside the pipeline.**
  `Strata.analyze()` takes the root it is given: a library caller and
  `scripts/analyze.mjs` choose their own path in code, and an environment
  variable has no business overruling them. It is requests that are untrusted,
  so `@strata/server` is where every one of them passes through
  `allowedDirectory()`.
- **`.git` existence marks a repository** in a listing rather than a `git` call
  per entry: a listing is one screenful of hints, and registering resolves the
  real thing anyway.

## 7. Quality & Risks

- **Risk:** unbounded history/churn on huge repos. **Mitigation:** `historyLimit`
  option and the incremental cache; worker queue on the roadmap.
- **Risk:** a plugin caches a value that depends on more than one file's
  contents, and serves it stale. **Mitigation:** the purity contract is in the
  SDK docs; `analyze({cache: false})` and `DELETE /cache` recover.
- **Risk:** the cache file grows without bound. **Mitigation:** entries carry a
  last-used stamp and are pruned after 30 days on open.
- **Risk:** the registry names a root that has since been moved or deleted.
  **Mitigation:** the entry is checked when it is added and whenever it is
  re-pointed, not forever; an analysis of a vanished root fails at the git call,
  and the project can be pointed at the new path (`update`) or removed.
- **Risk:** a stored config names a plugin that is no longer installed, or a
  revision that no longer exists. **Mitigation:** the API checks plugin ids
  against the registry as they are written; a stale one survives only until the
  next edit of that field, and an unknown revision fails the run it is used in
  rather than the settings screen. In a run, a stale id in an allow-list simply
  selects nothing — the plugin it names is not there to run — and a stale
  convention warns, because there the whole commit analysis goes quiet.
- **Risk:** a scope narrow enough to hide the interesting code makes a report
  look healthy. **Mitigation:** `run.files` is the count the run actually
  analysed rather than what the checkout holds, and *Analyze / run* prints who
  takes part, so a report is readable against the scope that produced it.
- **Risk:** an AI provider's `env` values are stored and served in plain text,
  so a token put there is readable by anyone who can reach the API.
  **Mitigation:** none yet — secret storage (write-only, redacted on read) is
  the next step in this area, and until it lands nothing sensitive belongs in
  provider settings. The store is local, and `$STRATA_TOKEN` decides who may
  read `/settings` at all — but a deployment that set no token serves them to
  whoever reaches the port.
- **Risk:** `listDirectory()` reads directories outside any repository, so a
  caller that exposes it exposes directory names. **Mitigation:** the roots
  above, no file names in the answer, and no content read at any point — plus
  the endpoint's own note in the server's architecture.
- **Risk:** `allowedDirectory()` resolves a path that is used a moment later,
  so a root replaced by a symlink in between would be read at its new target.
  **Mitigation:** none in-process — the window is a local race that needs write
  access to a directory inside the roots, which is already write access to the
  repositories being analysed. Keep the roots on a mount the API's own user
  cannot write to (`:ro` in the image).
- **Risk:** `git` output parsing edge cases (root commit, renames). **Mitigation:**
  record-separator parsing; covered by analysis smoke runs.
- **Risk:** a plugin runs **in-process, with the server's privileges** — the
  validation above stops a malformed or misdeclared plugin, not a malicious
  one, and installing a plugin is as much a trust decision as installing a
  dependency. **Mitigation:** the plugins directory is operator-controlled and
  local-only (nothing installs plugins over the network); isolation (worker
  threads / permissions) is a later step.
