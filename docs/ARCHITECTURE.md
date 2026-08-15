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
| 1 | **Extensibility** | New languages, commit conventions, metrics, and AI providers are added as plugins without changing the core. |
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
                                   ┌─────▼──────┐   optional   ┌────────────┐
                                   │  plugins   │ ───────────▶ │ AI provider│
                                   └────────────┘   HTTPS      └────────────┘
```

**In scope:** ingesting a local git repo, running analyses, serving and
rendering results, plugin loading, optional AI calls.
**Out of scope (today):** hosting git itself, auth/multi-tenant SaaS, writing to
the analysed repo.

### External interfaces

| Partner | Direction | Protocol | Purpose |
|---------|-----------|----------|---------|
| git CLI | out | process exec | history, blobs, file lists |
| AI provider | out | HTTPS (OpenAI-compatible or native) | explanations, embeddings |
| Web UI | in | REST/JSON | register projects, trigger analysis, render results |
| CI | in | CLI / container | headless analysis, gating |

## 4. Solution Strategy

| Challenge | Decision |
|-----------|----------|
| Extensibility | Four small plugin contracts in `@strata/sdk`; a registry loads them by manifest — the built-ins, plus drop-in third-party plugins from `STRATA_PLUGINS_DIR`. |
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
│   │              projects/ (types, schema, sqlite, memory, open, id, …) ·
│   │              config/ (types, defaults, patch, errors) ·
│   │              settings/ (types, defaults, patch, schema, sqlite, memory, …)
│   └── server/   @strata/server  Fastify HTTP API over the core
│                  app.ts · main.ts (entry) · registry.ts · routes/*
├── plugins/
│   ├── commit-conventional/      Conventional Commits parser   (commit-convention)
│   ├── git-coupling/             change-coupling metric         (git-metric)
│   ├── git-hotspots/             churn × complexity metric      (git-metric)
│   ├── language-typescript/      TS/JS graph, metrics, dead code (language)
│   └── ai-provider-template/     copy-me AI backend              (ai-provider)
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
- [`plugins/ai-provider-template/ARCHITECTURE.md`](../plugins/ai-provider-template/ARCHITECTURE.md)
- [`apps/web/ARCHITECTURE.md`](../apps/web/ARCHITECTURE.md)

### Level 2 — the four plugin kinds

| Kind | Contract (in `@strata/sdk`) | Produces |
|------|------------------------------|----------|
| `language` | `LanguagePlugin.analyze(ctx)` | `LanguageAnalysis` (graph, graph summary, dead code, metrics) |
| `commit-convention` | `CommitConventionPlugin.parse(commit)` | `ParsedCommit` |
| `git-metric` | `GitMetricPlugin.compute(ctx, history)` | `MetricSeries` |
| `ai-provider` | `AIProvider.chat()/embed()` | text / vectors |

The **core** (`@strata/core`) is the only building block that knows all four; it
builds a `RepoContext` and fans work out.

## 6. Runtime View

### Analyse a repository

1. `Strata.analyze({root, rev})` resolves `rev` → sha and branch, and lists
   tracked files (each with its blob sha).
2. Files are routed to `language` plugins by extension.
3. Commit history is streamed; `git-metric` plugins compute their series.
4. The active `commit-convention` plugin parses each commit.
5. Results merge into an `AnalysisReport`, returned by the API.

Steps 2 and 3 go through the cache. The core skips any plugin whose inputs
digest to a stored result — that part needs no cooperation. Per-file reuse
inside a plugin that does run is opt-in: only plugins that route their per-file
work through `ctx.cache.file()` skip unchanged blobs; one that ignores the
helper recomputes everything. The report carries the run's cache counters, and
its `run` block carries what the run itself did — branch, file count, duration
and finished-at, which is what the workbench header and the overview stat cards
render.

### Grant merge trust (governance runtime)

`/vouch @user` (issue comment) → `vouch-command` workflow validates the actor is
an owner, edits `.github/vouched.json`, commits it. The `vouch-gate` check then
lets that user's approvals unblock others' PRs.

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
- **Project configuration** — what an analysis of a project does (revision,
  history window, ignore globs and analyze paths, which language/metric plugins
  run, the commit convention, architecture rules), behind
  `/projects/:id/config`. Stored sparsely beside the registry entry and merged
  with the defaults on read, so an unset field follows the default rather than a
  copy of it. `/analyze` takes these as its defaults and lets an explicit
  request field win. Identity — display name and root — stays on the registry
  entry, which is the only place that can keep a root unique.
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
- **Security** — analysed repos mounted read-only; AI is opt-in. The HTTP API
  is unauthenticated and assumes a trusted network: `/analyze` takes any `root`
  on disk and `DELETE /cache` discards cached results (cost: a recomputation).
  Path allow-listing and an auth story are on the backlog; until then, do not
  expose the port beyond a trusted network.

## 9. Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| ADR-1 | TypeScript core (not Rust) | One language end-to-end; easy plugin authoring. Revisit if profiling demands. |
| ADR-2 | tree-sitter for parsing | One framework, many grammars, uniform AST. Grammars are loaded as **WebAssembly** (`web-tree-sitter` + pre-built `.wasm`), so a language plugin installs without a compiler. |
| ADR-3 | Shell out to `git` | Fastest and most complete; avoids reimplementing git. |
| ADR-4 | SQLite blob-keyed cache (`node:sqlite`) | Cheap incremental analysis for large repos, with no runtime dependency. |
| ADR-5 | Docker image is the primary deliverable | Matches "self-host over the browser". |
| ADR-6 | Vouch file over GitHub team | Works on a personal repo; auditable in git history. |
| ADR-7 | Web UI is a SvelteKit **static SPA** (Tailwind v4) | The build is plain files: the server can serve it from the same image, and the Tauri shell can load it from disk. Analysis is a local API call, so nothing needs server rendering. |

(Promote these into `docs/adr/NNNN-*.md` as they harden.)

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
| **Vouch** | Granting a contributor's approval the power to unblock merges. |
