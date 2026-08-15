# Module: `@strata/core` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **orchestrator**. Ingests a git repository, holds the plugin registry, builds
the immutable `RepoContext`, and drives the analysis pipeline that fans work out
to plugins. This is the only module that knows about all four plugin kinds.

It also owns what the workbench has to remember between runs: the incremental
cache, the **project registry** — which repositories are registered, and what
the last analysis of each one found — and each project's **configuration**,
what an analysis of it is supposed to do.

## 2. Constraints

- Reads git by shelling out to the `git` binary (must be on PATH).
- Hands plugins nothing but a `RepoContext` — the core injects no fs or network
  APIs. That is an interface contract, **not a sandbox**: a plugin runs
  in-process and can import `node:fs` itself (see §7).
- Pure in → out per file, so results stay cacheable/incremental.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk` (contracts), `git` CLI.
- **Consumed by:** `@strata/server` (and `scripts/analyze.mjs`).
- **Public API:** `Strata.analyze(opts) → AnalysisReport`, `PluginRegistry`,
  `discoverPlugins()` / `userPluginsDir()`, `openProjectStore()`, `gitUtil`
  helpers.

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | Barrel — the package's public surface, no logic. |
| `strata.ts` | The `Strata` orchestrator. |
| `types.ts` | `AnalyzeOptions`, `StrataOptions`, `AnalysisReport`, `RunReport`, `CacheReport`. |
| `logger.ts` | `createConsoleLogger(scope)` — what `RepoContext.log` gets. |
| `registry.ts` | `PluginRegistry` — load plugins, contain load failures, `byKind()` / `loadedByKind()`. |
| `manifest.ts` | `readManifest()` / `resolveEntry()` — validate a `strata.plugin.json` and its entry path. |
| `plugin-shape.ts` | `pluginShapeError()` — does the module implement the kind it claims? |
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
| `config/types.ts` | `ProjectConfig`, `ProjectConfigPatch`, `ArchitectureRule`. |
| `config/defaults.ts` | `DEFAULT_PROJECT_CONFIG` + `withDefaults()` — fill a stored config out. |
| `config/patch.ts` | `applyPatch()` — merge, normalise, refuse what cannot be stored. |
| `config/errors.ts` | `InvalidConfigError`. |

## 5. Runtime

`analyze()`:
1. `resolveRev` → sha; `branchAt` → branch (or none); `listFiles` → `RepoFile[]`
   (blob-keyed).
2. Build `RepoContext`, one `cache` scope per plugin.
3. Route files to `language` plugins by extension — skipping any plugin whose
   input digest already has a stored result.
4. Stream `history`; run `git-metric` plugins (same skip).
5. Parse commits with the first `commit-convention` plugin.
6. Merge into `AnalysisReport`, with the run's own metadata (`RunReport`:
   branch, file count, duration, finished-at) beside the resolved `rev`.

`openProjectStore()` is independent of a run: it opens `projects.db` once, and
the entries it holds are read on request (`list` / `get` / `findByRoot` /
`config`) and written when a project is added, renamed, re-pointed, configured,
analysed or removed.

A project's config is stored **sparsely** — only the fields someone set — and
`withDefaults()` fills it out on the way to a caller. `setConfig()` merges a
patch through `applyPatch()`, which normalises (trims, drops blank rows,
collapses duplicates) and throws `InvalidConfigError` on a value that cannot
mean anything.

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
- **First-registered commit convention wins** (single active convention).
- **The run times itself** — duration covers everything the caller waited for,
  cache open included, and `finishedAt` is stamped where the run ends. A client
  measuring its own round-trip would be measuring the network too. A revision
  that names no branch (detached HEAD, sha, tag) reports `null` rather than
  inventing one.
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
  rather than the settings screen.
- **Risk:** `git` output parsing edge cases (root commit, renames). **Mitigation:**
  record-separator parsing; covered by analysis smoke runs.
- **Risk:** a plugin runs **in-process, with the server's privileges** — the
  validation above stops a malformed or misdeclared plugin, not a malicious
  one, and installing a plugin is as much a trust decision as installing a
  dependency. **Mitigation:** the plugins directory is operator-controlled and
  local-only (nothing installs plugins over the network); isolation (worker
  threads / permissions) is a later step.
