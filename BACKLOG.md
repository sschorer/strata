# Strata — Backlog

Features and technical work, grouped by area. Rough priority: **P0** = next,
**P1** = soon, **P2** = later. Check items off as they ship.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Core & platform

- [x] Plugin SDK contracts (language / commit-convention / git-metric / ai-provider)
- [x] Orchestrator + git ingest + plugin registry
- [x] HTTP API (`/health`, `/plugins`, `/analyze`)
- [x] Incremental cache — SQLite, keyed on `(pluginId, blob)`; skip unchanged files
- [ ] **P0** Third-party plugin discovery — load a user plugins directory, not just built-ins
- [ ] **P1** Worker queue for heavy analyses (BullMQ / worker_threads); progress events
- [ ] **P1** Analyse a bare/remote repo (clone-on-demand) and a specific `rev` range
- [ ] **P1** Path allow-listing / sandbox for the `root` a request may analyse
- [ ] **P2** Snapshot & compare two revisions (trend deltas)
- [ ] **P2** Plugin config schema + per-plugin settings surfaced to the UI

## Git / history intelligence

- [x] Hotspots (churn × complexity)
- [ ] **P0** Change coupling — files that change together (temporal coupling)
- [ ] **P1** Knowledge map / bus factor — contribution concentration per file/dir
- [ ] **P1** Code age — stable vs. actively-churning regions
- [ ] **P1** Commit analytics dashboard — type/scope breakdown, breaking-change timeline
- [ ] **P2** Author/ownership graph; main contributor per module
- [ ] **P2** Ignore-globs for metrics (exclude lockfiles/generated)

## Language modules

- [x] TypeScript/JavaScript starter (import graph + cycles)
- [ ] **P0** Replace regex scan with **tree-sitter** (accurate resolution, aliases, dynamic imports)
- [ ] **P0** Real dead code — unreferenced exports, unreachable files, unused deps
- [ ] **P0** Real metrics — cyclomatic complexity, nesting, duplication
- [ ] **P1** **Angular** module — component/module/service graph, DI graph, standalone vs NgModule, lazy boundaries, unused components
- [ ] **P1** **PHP** module — dependency graph + dead code
- [ ] **P2** Cross-language project graph (e.g. TS frontend ↔ PHP backend boundaries)

## Architecture fitness

- [ ] **P1** Rule engine — declare allowed/forbidden dependencies ("`ui` may not import `db`")
- [ ] **P1** Boundary/layer violation report + CI gate
- [ ] **P2** Fitness-function trends over time

## AI

- [x] AI-provider contract + template (OpenAI-compatible / Ollama)
- [ ] **P1** "Explain this hotspot / module" action
- [ ] **P1** Natural-language query over the repo (RAG on the analysis DB + embeddings)
- [ ] **P1** Provider registry + settings UI (add provider, key, model)
- [ ] **P2** PR/commit risk assessment
- [ ] **P2** Auto-generate/refresh architecture docs from the graphs

## Web UI (`apps/web`)

- [ ] **P0** Scaffold the frontend (Vite + SvelteKit/Next + Tailwind)
- [ ] **P0** Hotspot treemap view
- [ ] **P0** Dependency graph view (Cytoscape/d3) with cycle highlighting
- [ ] **P1** Commit analytics view
- [ ] **P1** AI provider settings screen
- [ ] **P2** Multi-repo workspace; saved views

## CI / delivery

- [x] CI (build/typecheck/lint/test), Conventional Commits enforcement (hook + CI)
- [x] release-please + multi-arch GHCR image + Linux desktop stub
- [ ] **P1** Headless CI mode — emit JSON/Markdown report, **fail on thresholds** (hotspot regression, new cycles)
- [ ] **P1** Commit the pnpm lockfile and switch CI to `--frozen-lockfile`
- [ ] **P2** Tauri desktop app under `apps/desktop` (enable the Linux release job)
- [ ] **P2** Add macOS/Windows to the desktop release matrix (+ signing)

## Docs & DX

- [x] arc42 architecture + per-module docs + Makefile + `analyze`/`new-plugin` scripts
- [ ] **P1** ADR folder (`docs/adr/`) — promote ADR-1…6 into standalone records
- [ ] **P2** Example gallery / screenshots once the UI exists
