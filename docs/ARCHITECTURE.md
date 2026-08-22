# Strata — Architecture (arc42)

> This document follows the [arc42](https://arc42.org/) template. Per-module
> architecture docs live next to each module as `ARCHITECTURE.md` and use the
> same (trimmed) format — see the [Building Block View](#5-building-block-view).

## 1. Introduction and Goals

Strata is a modular git & code-analysis workbench. You point it at a repository
and it surfaces **hotspots**, **commit analytics**, per-language **dependency
graphs / dead code**, and **AI-assisted** insights — runnable locally or
self-hosted over the browser.

### Quality goals

| # | Goal | Motivation |
|---|------|-----------|
| 1 | **Extensibility** | New languages, commit conventions and metrics are added as plugins without changing the core; an AI provider is added as configuration. |
| 2 | **Correctness** | Analysis reflects real repository state; results are reproducible for a given revision. |
| 3 | **Performance** | Large repos analysed incrementally — only changed files are re-processed. |
| 4 | **Portability** | One codebase runs as a self-hosted Docker service and (later) a desktop app. |
| 5 | **Local-first / privacy** | Works fully offline; AI is optional and can be a local model. |

### Stakeholders

| Role | Interest |
|------|----------|
| Repo owner / lead dev | Health of a codebase; where risk concentrates. |
| Contributor | Understand an unfamiliar module before changing it. |
| Plugin author | Stable contracts to extend Strata. |

## 2. Architecture Constraints

- **TypeScript / ESM / Node ≥ 20** across the whole stack (one language).
- **pnpm workspace monorepo**; packages published as `@strata/*`.
- Analysis must run **without network** (AI excluded).
- Git is consumed by **shelling out to `git`** (must be on PATH / in the image).
- Plugin contracts are **SemVer-versioned**; breaking them is a major bump.
- Conventional Commits are **mandatory** (local hook + CI check).

## 3. Context and Scope

```
      ┌──────────┐   HTTP/REST    ┌───────────────┐   shell    ┌────────┐
      │  Web UI  │ ─────────────▶ │ @strata/server │ ────────▶ │  git   │
      │ (apps/web│ ◀───────────── │   + core       │           └────────┘
      └──────────┘   JSON report  └──────┬────────┘
                                         │ loads
                                   ┌─────▼──────┐
                                   │  plugins   │
                                   └────────────┘

      a finished report ─────────▶ AI features ──spawn──▶ coding-agent CLI
                                   (never part of a run)
```

**In scope:** ingesting a local git repo, running analyses, serving and
rendering results, plugin loading, optional AI calls over a finished report.
**Out of scope (today):** hosting git itself, user accounts / multi-tenant SaaS
(the API takes one shared token, not a directory of users), writing to the
analysed repo.

### External interfaces

| Partner | Direction | Protocol | Purpose |
|---------|-----------|----------|---------|
| git CLI | out | process exec | history, blobs, file lists |
| AI provider | out | process exec (a configured coding-agent CLI) | explanations, embeddings |
| Web UI | in | REST/JSON | register projects, trigger analysis, render results |
| CI | in | CLI / container | headless analysis, gating |

## 4. Solution Strategy

| Challenge | Decision |
|-----------|----------|
| Extensibility | Three small plugin contracts in `@strata/sdk`; a registry loads them by manifest — the built-ins, plus drop-in third-party plugins from `STRATA_PLUGINS_DIR`. |
| One tool, many languages | Parsing standardised on **tree-sitter** grammars (WASM, so no native build step); analyzers return a common shape. |
| Big-repo performance | Blob-sha-keyed incremental cache (SQLite) in the core. |
| Portability | Web frontend + thin API, packaged as a Docker image now and Tauri desktop later. |
| Governance | Conventional Commits + release-please automate versioning/releases. |

## 5. Building Block View

### Level 1 — the monorepo

```
strata/
├── packages/
│   ├── sdk/      @strata/sdk     Plugin contracts (the public API surface)
│   │              index.ts barrel · one module per contract (repo, graph,
│   │              language, commit, metric, ai, cache, manifest, logger)
│   ├── core/     @strata/core    Orchestrator: git ingest, registry, pipeline
│   │              strata.ts · types.ts · logger.ts · registry.ts ·
│   │              manifest.ts · discover.ts · plugins-dir.ts ·
│   │              git/ (exec, rev, branch, repo, files, history, churn) ·
│   │              cache/ (types, schema, sqlite, null, open, keys, digest, …) ·
│   │              progress/ (types, tracker) · jobs/ (queue, key, inline, …) ·
│   │              projects/ (types, schema, sqlite, memory, open, id, …) ·
│   │              config/ (types, defaults, patch, errors) ·
│   │              settings/ (types, defaults, patch, schema, sqlite, memory, …)
│   └── server/   @strata/server  Fastify HTTP API over the core
│                  app.ts · main.ts (entry) · registry.ts · routes/* ·
│                  worker/ (analysis-worker, runner, thread, protocol)
├── plugins/
│   ├── commit-conventional/      Conventional Commits parser   (commit-convention)
│   ├── git-coupling/             change-coupling metric         (git-metric)
│   ├── git-hotspots/             churn × complexity metric      (git-metric)
│   └── language-typescript/      TS/JS graph, metrics, dead code (language)
├── apps/
│   └── web/     @strata/web      Web UI (SvelteKit SPA + Tailwind)
│                  app.css + lib/theme/ (tokens, both palettes) ·
│                  lib/api/ (one module per endpoint) · lib/components/ · routes/
├── scripts/                      analyze.mjs, new-plugin.mjs (dev actions)
└── docs/                         this file + per-module ARCHITECTURE.md
```

Each **module** carries its own `ARCHITECTURE.md` in the same arc42-trimmed
format (Purpose, Constraints, Interfaces, Building Blocks, Runtime, Decisions,
Quality/Risks). Start here:

- [`packages/sdk/ARCHITECTURE.md`](../packages/sdk/ARCHITECTURE.md)
- [`packages/core/ARCHITECTURE.md`](../packages/core/ARCHITECTURE.md)
- [`packages/server/ARCHITECTURE.md`](../packages/server/ARCHITECTURE.md)
- [`plugins/commit-conventional/ARCHITECTURE.md`](../plugins/commit-conventional/ARCHITECTURE.md)
- [`plugins/git-coupling/ARCHITECTURE.md`](../plugins/git-coupling/ARCHITECTURE.md)
- [`plugins/git-hotspots/ARCHITECTURE.md`](../plugins/git-hotspots/ARCHITECTURE.md)
- [`plugins/language-typescript/ARCHITECTURE.md`](../plugins/language-typescript/ARCHITECTURE.md)
- [`apps/web/ARCHITECTURE.md`](../apps/web/ARCHITECTURE.md)

### Level 2 — the three plugin kinds

| Kind | Contract (in `@strata/sdk`) | Produces |
|------|------------------------------|----------|
| `language` | `LanguagePlugin.analyze(ctx)` | `LanguageAnalysis` (graph, graph summary, dead code, metrics) |
| `commit-convention` | `CommitConventionPlugin.parse(commit)` | `ParsedCommit` |
| `git-metric` | `GitMetricPlugin.compute(ctx, history)` | `MetricSeries` |

There is no AI kind: a provider is a configured instance in the app settings and
the call surface for one is internal to the core
([ADR-13](./adr/0013-providers-are-configured-instances.md)).

The **core** (`@strata/core`) is the only building block that knows all three;
it builds a `RepoContext` and fans work out.

## 6. Runtime View

### Analyse a repository

`POST /analyze` does not run anything on the HTTP thread. It puts the request on
the **analysis queue**, which runs one job at a time on a **worker thread** that
owns the plugins and the incremental cache; the handler either waits for the
report (the default, so CI and `curl` keep the endpoint they had) or answers
`202` with the job. Either way the run is followable — `GET /jobs/:id/events`
streams each step as the pipeline takes it, which is what lets *Re-analyze* show
a running state instead of a button that has stopped responding. What the
pipeline then does, on that thread:

1. `Strata.analyze({root, rev})` resolves `rev` → sha and branch, and lists
   tracked files (each with its blob sha), narrowed once to the project's
   scope — its analyse paths, minus its ignore globs.
2. Files are routed to the enabled `language` plugins by extension.
3. Commit history is streamed; the enabled `git-metric` plugins compute their
   series.
4. The active `commit-convention` plugin parses each commit, and the core folds
   the parsed log into `CommitAnalytics` — per type, per scope, how much of the
   history conforms, breaking changes, weekly activity.
5. The per-language graphs are folded into one cross-language graph — merged,
   summarised, and with every import cycle ordered into a path — so no consumer
   has to derive it a second time
   ([ADR-10](./adr/0010-open-analysis-pipeline.md)).
6. Results merge into an `AnalysisReport`, returned by the API.

Which plugins are "enabled" and which convention is "active" are the project's
configuration; a project that has configured neither runs every plugin and
parses with the first convention registered. The scope and those lists are
applied at the top of the pipeline rather than inside any plugin, so one answer
serves the plugins, the file count the report prints and the cache keys alike.

Configuration that names a plugin this workbench has not loaded gets **no run**,
whichever setting named it, and the failure is raised before step 1 reads
anything. Dropping the name instead would produce a report that reads like a
clean one — an analysis missing the plugin that would have found the problem
looks exactly like an analysis that found no problem, and a gate reading it
passes a build that checked nothing
([ADR-12](./adr/0012-repo-owned-config-file.md)).

Steps 2 and 3 go through the cache. The core skips any plugin whose inputs
digest to a stored result — that part needs no cooperation. Per-file reuse
inside a plugin that does run is opt-in: only plugins that route their per-file
work through `ctx.cache.file()` skip unchanged blobs; one that ignores the
helper recomputes everything. The report carries the run's cache counters, and
its `run` block carries what the run itself did — branch, file count, duration
and finished-at, which is what the workbench header and the overview stat cards
render.

Every step above is announced to whoever is following the job: the two per-plugin
stages repeat once per plugin that actually takes part, and the run's total is
reported as unknown until the file list makes it knowable.

### Grant merge trust (governance runtime)

`/vouch @user` (issue comment) → `vouch-command` workflow validates the actor is
an owner, edits `.github/vouched.json`, commits it. The `vouch-gate` check then
lets that user's approvals unblock others' PRs, and lets their own PRs through
without one. `dependabot[bot]` is vouched for the second half alone: a bot never
files a review, so the approval path would strand its weekly bumps.

## 7. Deployment View

| Target | Artifact | Notes |
|--------|----------|-------|
| Self-host (server) | `ghcr.io/sschorer/strata` multi-arch image | `docker run` / `compose.yml`; mounts repos read-only |
| CI | same image / `make analyze` | headless report, threshold gating (roadmap) |
| Desktop | Tauri Linux bundles (`.AppImage`/`.deb`) | macOS/Windows deferred |

Releases are triggered by hand from the Actions tab (**Release** workflow) —
nothing publishes on a merge to main. Pick `nightly` for a throwaway
`ghcr.io/sschorer/strata:nightly` image, or `normal` to drive **release-please**:
the first run opens the version-bump/CHANGELOG PR, and a second run after
merging it cuts the tag + GitHub Release, which triggers the multi-arch Docker
publish. The Linux desktop job is still a stub — it produces no bundle until
`apps/desktop` exists and `tauri-action` is enabled.

## 8. Cross-cutting Concepts

- **Plugin model** — `define*` helpers stamp the `kind` discriminant; the
  registry refuses a plugin whose manifest `sdk` major mismatches.
- **Stage declarations** — a manifest may also declare its plugin's **stage**:
  the output types it consumes, the one it produces, the files it filters on and
  the exclusive group it belongs to. Static JSON, validated before the entry
  module is imported, so a run is planned without running third-party code
  ([ADR-10](./adr/0010-open-analysis-pipeline.md)); where the exported object
  says the same thing, the registry holds the two to each other at load. Read
  and reported (`GET /plugins`) but not yet scheduled from — the three kinds
  above still drive a run.
- **RepoContext** — the single immutable surface plugins are allowed to touch
  (`root`, `rev`, `files`, `git()`, `log`, `cache`).
- **Incremental cache** — two levels in one SQLite file (`node:sqlite`, no
  dependency): per-file results keyed on `(pluginId, pluginVersion, blob)` and
  offered to plugins as `RepoContext.cache`, plus whole-plugin-run results keyed
  on a digest of every input. A git blob sha is a content hash, so an entry
  survives across revisions, branches and repositories; the plugin version in
  the key means a new plugin build invalidates its own entries. Stored in
  `$STRATA_CACHE_DIR`, else `<cwd>/.strata/cache.db` — the server and image put
  that outside the analysed repo, and the core warns if the resolved path lands
  inside it. `STRATA_CACHE=0`, `analyze({cache: false})` or `DELETE /cache` turn
  it off or empty it. A cache that cannot be opened, read or written degrades to
  a pass-through with one warning — it never fails an analysis.
- **Project registry** — the repositories this workbench knows about (id,
  display name, root, last-analysis summary), behind `/projects`. A second
  SQLite file (`$STRATA_DATA_DIR`, else `<cwd>/.strata/projects.db`), separate
  from the cache on purpose: everything in the cache is derived and gets pruned,
  cleared and wiped, and none of that may cost someone their list of projects.
  Roots are stored as the git working-tree root they resolve to, so one
  repository is one entry; every `/analyze` over a registered root refreshes
  that entry's summary. Removing a project drops the row and nothing else — the
  repository on disk is never touched.
- **Path allow-list** — one list says what Strata may reach on disk
  (`$STRATA_ROOTS`, `PATH`-separated; the server user's home by default, the
  read-only `/repos` mount in the image), and every path that arrives in a
  request is confined to it: what `/browse` lists, what `/projects` may
  register or re-point to, and what `/analyze` may walk. Paths are resolved
  through their symlinks *before* they are checked and the resolved path is
  what gets used, so a link cannot step outside a root — and a subdirectory
  whose repository begins above one is refused rather than registered. Outside
  is a 403; a path inside a root that is not a directory is a 404, and a
  missing path outside one gets the same 403 as anything else out there, so the
  API is no way to ask what exists on the disk. It confines every caller,
  including one holding the token — the two limits answer different questions:
  see *API token* below.
- **API token** — who may call at all. `$STRATA_TOKEN` is one shared secret for
  the workbench, presented as `Authorization: Bearer <token>` and checked
  before a request is routed, parsed or resolved; anything but `/health` — the
  liveness probe, which a container watcher calls without a credential —
  answers 401 without it. Compared in constant time, over digests, and read
  from the header alone: a token in a query string lands in the request log and
  the browser's history, and one in a cookie would need a CSRF story. Leaving
  it unset keeps the API open, which is the reasonable default on the machine
  being analysed and a warning at every startup anywhere else.
- **Folder browsing** — `/browse` lists the subdirectories of one directory on
  the server's machine and marks which are git working trees, so *Add project*
  can be a tree rather than a path the reader has to know by heart. Names of
  directories only — no files, no contents — inside the allow-list above.
- **Project configuration** — what an analysis of a project does (revision,
  history window, ignore globs and analyze paths, which language/metric plugins
  run, the commit convention, architecture rules), behind
  `/projects/:id/config`. Stored sparsely beside the registry entry and merged
  with the defaults on read, so an unset field follows the default rather than a
  copy of it. Every run over a registered root reads them: the revision and the
  history window as defaults an explicit request field may override, the scope,
  the plugin lists and the convention as the project's own — a caller wanting a
  different scope is describing a different project, not a different run.
  Identity — display name and root — stays on the registry entry, which is the
  only place that can keep a root unique. (Architecture rules are stored and
  served; enforcing them needs the rule engine.)
- **App settings** — how the workbench itself behaves (appearance, the plugins
  directory and third-party loading, the incremental cache, the CI gate
  thresholds, the AI provider instances), behind `/settings`. A third SQLite
  file (`$STRATA_DATA_DIR`, else `<cwd>/.strata/settings.db`), stored sparsely
  and defaulted on read like a project's config. Two scopes, split by what the
  setting belongs to: nothing here is about one repository, and nothing in
  `/projects/:id/config` is about the workbench. Reading a setting is not the
  same as it taking effect — the cache toggle applies to the next run, the
  plugin settings are read when the server starts (which is when plugins load),
  and appearance, gates and providers are stored for consumers still being
  built.
- **One responsibility per file** — implementation, types, helpers and
  alternate implementations live in separate modules; every `index.ts` is a
  barrel that only re-exports. Public import paths (`@strata/core`,
  `@strata/sdk`) therefore stay stable as internals move. See CONTRIBUTING.
- **Configuration** — `.env` (see `.env.example`); AI creds never committed.
- **Logging** — structured logger injected via `RepoContext.log`.
- **Security** — analysed repos mounted read-only; AI is opt-in. Two limits sit
  in front of the API and neither replaces the other: `$STRATA_TOKEN` says who
  may call, `$STRATA_ROOTS` says what any caller may reach (see *API token* and
  *Path allow-list* above). Without a token the port is open to whoever can
  reach it — `DELETE /cache` discards cached results (cost: a recomputation),
  `DELETE /projects/:id` drops a registry entry, `PATCH /settings` names the
  directory the next start loads plugins from — which is why startup says so
  until one is set. Set it, and terminate TLS in front, before the port is
  reachable from anywhere but the machine it runs on.

## 9. Architecture Decisions

Each decision is a record in [`docs/adr/`](./adr/). This table is the index;
the record holds the trade-off and what it costs us.

| ID | Decision |
|----|----------|
| [ADR-1](./adr/0001-typescript-core.md) | TypeScript core, not Rust |
| [ADR-2](./adr/0002-tree-sitter-parsing.md) | tree-sitter for parsing, loaded as WebAssembly |
| [ADR-3](./adr/0003-shell-out-to-git.md) | Shell out to `git` rather than link a git library |
| [ADR-4](./adr/0004-sqlite-blob-keyed-cache.md) | Incremental cache in SQLite, keyed on the git blob sha |
| [ADR-5](./adr/0005-docker-image-primary-deliverable.md) | The Docker image is the primary deliverable |
| [ADR-6](./adr/0006-vouch-file-over-github-team.md) | Merge trust lives in a vouched file, not a GitHub team |
| [ADR-7](./adr/0007-web-ui-static-spa.md) | The web UI is a SvelteKit static SPA |
| [ADR-8](./adr/0008-shared-bearer-token.md) | One shared bearer token for the API, opt-in |
| [ADR-9](./adr/0009-worker-thread-analysis-queue.md) | Heavy analyses on a worker thread behind an in-process queue |
| [ADR-10](./adr/0010-open-analysis-pipeline.md) | The analysis pipeline is an open, dependency-ordered graph of stages |
| [ADR-11](./adr/0011-sdk-0-2-0-single-break.md) | One breaking SDK wave to 0.2.0, and deliberately not 1.0.0 |
| [ADR-12](./adr/0012-repo-owned-config-file.md) | The analysed repository owns its analysis config |
| [ADR-13](./adr/0013-providers-are-configured-instances.md) | AI providers are configured instances, not plugins |
| [ADR-14](./adr/0014-cli-and-its-trust-model.md) | A first-class CLI beside the server, with no path allow-list |
| [ADR-15](./adr/0015-partial-runs-and-per-stage-status.md) | A stage failure fails its dependents, not the run |

ADR-10 through ADR-15 are **accepted but not yet implemented** — sections 5, 6
and 8 above still describe the shipped three-phase pipeline. ADR-11 holds the
landing order.

New decisions are written straight into `docs/adr/` and listed here. The
project's vocabulary is [`CONTEXT-MAP.md`](../CONTEXT-MAP.md).

## 10. Quality Requirements

| Quality | Scenario | Target |
|---------|----------|--------|
| Extensibility | Add a Python language plugin | No core change; only a new `plugins/*` package — or, from outside this repo, a directory dropped into `STRATA_PLUGINS_DIR`. |
| Performance | Re-analyse a 50k-file repo after a 1-file change | Only that file re-parsed; an unchanged repo skips the plugins entirely. |
| Correctness | Import cycles in TS | All SCCs > 1 node reported. |
| Portability | Fresh machine with Docker | `docker run` yields a working API. |

## 11. Risks and Technical Debt

| Risk / debt | Impact | Mitigation |
|-------------|--------|-----------|
| TS resolution is not the compiler's | An import resolved through neither a relative path nor a `tsconfig` alias (a bundler's own aliases, `package.json` `imports`, a workspace package name) draws no edge | tree-sitter parses every file and `tsconfig.json` `paths`/`baseUrl` are honoured; the remaining schemes are per-project settings on the backlog. |
| Cache is only as pure as its plugins | A `cache.file()` value that depends on more than the file's contents goes stale | Contract documented in the SDK; plugin version is part of the key, `DELETE /cache` is the escape hatch. |
| Complexity proxy is indentation-based | Rough hotspot scores | Feed real cyclomatic complexity from language plugins. |
| Web UI is a scaffold | Only the theme layer and API client exist; no analysis screens yet | Build the shell and views on top (see backlog / the *web-ui* issues). |
| One analysis at a time | A long run delays the next | Deliberate: runs share one cache and one CPU, so concurrent ones would be slower and would contend on the same database. Identical requests join the run in flight rather than queueing behind it. |
| Plugins load on both threads | Twice the load cost and memory at startup | The price of the HTTP and analysis threads sharing no state. If it matters, the worker can report its registry back for `/plugins` to serve. |
| Third-party plugins run in-process | A plugin has the server's privileges | Manifest/entry validation and id protection on load; installing one is a trust decision, and the plugins directory is operator-controlled. Isolation is a later step. |
| Vouch-bot needs push to `main` | May hit branch protection | Bypass entry or PR-mode fallback (documented). |

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Hotspot** | A file scoring high on change frequency × complexity. |
| **Churn** | Number of commits that touched a file in the window. |
| **Change coupling** | Files that tend to change in the same commits. |
| **RepoContext** | The immutable repo view handed to plugins. |
| **Plugin manifest** | `strata.plugin.json` describing a plugin to the registry. |
| **Project** | A repository registered with this workbench: id, display name, root, last-analysis summary. |
| **Job** | One analysis on the queue — queued, running, then succeeded or failed. Outlives the request that asked for it. |
| **Vouch** | Granting a contributor's approval the power to unblock merges. |
