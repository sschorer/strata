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
| Web UI | in | REST/JSON | trigger analysis, render results |
| CI | in | CLI / container | headless analysis, gating |

## 4. Solution Strategy

| Challenge | Decision |
|-----------|----------|
| Extensibility | Four small plugin contracts in `@strata/sdk`; a registry loads them by manifest. |
| One tool, many languages | Parsing standardised on **tree-sitter** grammars (roadmap); analyzers return a common shape. |
| Big-repo performance | Blob-sha-keyed incremental cache (SQLite, roadmap) in the core. |
| Portability | Web frontend + thin API, packaged as a Docker image now and Tauri desktop later. |
| Governance | Conventional Commits + release-please automate versioning/releases. |

## 5. Building Block View

### Level 1 — the monorepo

```
strata/
├── packages/
│   ├── sdk/      @strata/sdk     Plugin contracts (the public API surface)
│   ├── core/     @strata/core    Orchestrator: git ingest, registry, pipeline
│   └── server/   @strata/server  Fastify HTTP API over the core
├── plugins/
│   ├── commit-conventional/      Conventional Commits parser   (commit-convention)
│   ├── git-hotspots/             churn × complexity metric      (git-metric)
│   ├── language-typescript/      TS/JS import graph + cycles     (language)
│   └── ai-provider-template/     copy-me AI backend              (ai-provider)
├── apps/
│   └── web/                      Web UI (dashboards) — placeholder
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
- [`plugins/git-hotspots/ARCHITECTURE.md`](../plugins/git-hotspots/ARCHITECTURE.md)
- [`plugins/language-typescript/ARCHITECTURE.md`](../plugins/language-typescript/ARCHITECTURE.md)
- [`plugins/ai-provider-template/ARCHITECTURE.md`](../plugins/ai-provider-template/ARCHITECTURE.md)
- [`apps/web/ARCHITECTURE.md`](../apps/web/ARCHITECTURE.md)

### Level 2 — the four plugin kinds

| Kind | Contract (in `@strata/sdk`) | Produces |
|------|------------------------------|----------|
| `language` | `LanguagePlugin.analyze(ctx)` | `LanguageAnalysis` (graph, dead code, metrics) |
| `commit-convention` | `CommitConventionPlugin.parse(commit)` | `ParsedCommit` |
| `git-metric` | `GitMetricPlugin.compute(ctx, history)` | `MetricSeries` |
| `ai-provider` | `AIProvider.chat()/embed()` | text / vectors |

The **core** (`@strata/core`) is the only building block that knows all four; it
builds a `RepoContext` and fans work out.

## 6. Runtime View

### Analyse a repository

1. `Strata.analyze({root, rev})` resolves `rev` → sha and lists tracked files
   (each with its blob sha).
2. Files are routed to `language` plugins by extension.
3. Commit history is streamed; `git-metric` plugins compute their series.
4. The active `commit-convention` plugin parses each commit.
5. Results merge into an `AnalysisReport`, returned by the API.

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
publish and the Linux desktop build.

## 8. Cross-cutting Concepts

- **Plugin model** — `define*` helpers stamp the `kind` discriminant; the
  registry refuses a plugin whose manifest `sdk` major mismatches.
- **RepoContext** — the single immutable surface plugins are allowed to touch
  (`root`, `rev`, `files`, `git()`, `log`).
- **Incremental cache (roadmap)** — analysis keyed on `(pluginId, blob)`.
- **Configuration** — `.env` (see `.env.example`); AI creds never committed.
- **Logging** — structured logger injected via `RepoContext.log`.
- **Security** — analysed repos mounted read-only; AI is opt-in.

## 9. Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| ADR-1 | TypeScript core (not Rust) | One language end-to-end; easy plugin authoring. Revisit if profiling demands. |
| ADR-2 | tree-sitter for parsing | One framework, many grammars, uniform AST. |
| ADR-3 | Shell out to `git` | Fastest and most complete; avoids reimplementing git. |
| ADR-4 | SQLite blob-keyed cache | Cheap incremental analysis for large repos. |
| ADR-5 | Docker image is the primary deliverable | Matches "self-host over the browser". |
| ADR-6 | Vouch file over GitHub team | Works on a personal repo; auditable in git history. |

(Promote these into `docs/adr/NNNN-*.md` as they harden.)

## 10. Quality Requirements

| Quality | Scenario | Target |
|---------|----------|--------|
| Extensibility | Add a Python language plugin | No core change; only a new `plugins/*` package. |
| Performance | Re-analyse a 50k-file repo after a 1-file change | Only that file re-parsed (with cache). |
| Correctness | Import cycles in TS | All SCCs > 1 node reported. |
| Portability | Fresh machine with Docker | `docker run` yields a working API. |

## 11. Risks and Technical Debt

| Risk / debt | Impact | Mitigation |
|-------------|--------|-----------|
| Regex-based TS import scan (starter) | Misses/false edges | Replace with tree-sitter / TS compiler API. |
| No cache yet | Slow on large repos | Implement the blob-keyed SQLite cache (ADR-4). |
| Complexity proxy is indentation-based | Rough hotspot scores | Feed real cyclomatic complexity from language plugins. |
| Web UI not scaffolded | No visual output yet | Build `apps/web` (see backlog). |
| Vouch-bot needs push to `main` | May hit branch protection | Bypass entry or PR-mode fallback (documented). |

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Hotspot** | A file scoring high on change frequency × complexity. |
| **Churn** | Number of commits that touched a file in the window. |
| **Change coupling** | Files that tend to change in the same commits. |
| **RepoContext** | The immutable repo view handed to plugins. |
| **Plugin manifest** | `strata.plugin.json` describing a plugin to the registry. |
| **Vouch** | Granting a contributor's approval the power to unblock merges. |
