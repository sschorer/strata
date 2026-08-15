# Strata — Backlog

Features and technical work, grouped by area. Rough priority: **P0** = next,
**P1** = soon, **P2** = later. Check items off as they ship.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

The UI items below track the **workbench mockup** (Claude Design → *Strata Web
UI*): a left rail with a project switcher and five analysis screens, plus a
two-scope settings area (**Project settings** and app-wide **Settings**).
Anything marked *(mockup)* exists as a design and needs an implementation.

---

## Core & platform

- [x] Plugin SDK contracts (language / commit-convention / git-metric / ai-provider)
- [x] Orchestrator + git ingest + plugin registry
- [x] HTTP API (`/health`, `/plugins`, `/analyze`)
- [x] Incremental cache — SQLite, keyed on `(pluginId, blob)`; skip unchanged files
- [x] Analysis run metadata in the `/analyze` result — every report carries a
      `run` block (branch, file count, duration, finished-at) beside the
      resolved `rev`, which is what the mockup header (`main · @ 4c1249e ·
      analyzed 2 min ago · 1.82s`) and the overview stat cards read. Rendering
      that header is UI work, listed below.
- [x] Third-party plugin discovery (API) — `STRATA_PLUGINS_DIR` is scanned for
      drop-in plugins alongside the built-ins; `/plugins` reports the directory,
      each plugin's source, and anything skipped. The *Settings → Plugins &
      engine → Plugins directory* screen that renders it is still to build
      (*mockup*), with the UI work below.
- [ ] **P0** Path allow-listing / sandbox for the `root` a request may analyse —
      a prerequisite now that the UI lets a user register arbitrary project roots.
- [ ] **P1** Worker queue for heavy analyses (BullMQ / worker_threads); progress
      events so *Re-analyze* can show a running state instead of blocking.
- [ ] **P1** Analyse a bare/remote repo (clone-on-demand) and a specific `rev` range
- [ ] **P2** Snapshot & compare two revisions (trend deltas)
- [ ] **P2** Plugin config schema + per-plugin settings surfaced to the UI

## Configuration & persistence

New area — the mockup's settings screens need somewhere to write to.

- [x] Project registry — `projects.db` (`$STRATA_DATA_DIR`, its own database
      beside the cache) holds id, display name, root and last-analysis summary
      per project, behind `GET`/`POST` `/projects` and `GET`/`DELETE`
      `/projects/:id`. A root is resolved to the repository that owns it, so one
      repo is one entry; every `/analyze` over a registered root refreshes that
      entry's summary; removing drops the entry only, never the repo on disk.
      The sidebar switcher, *Add project* and *Danger zone → Remove project*
      that render it are UI work, listed below.
- [x] Project-scoped config store + endpoints — `GET`/`PATCH`
      `/projects/:id/config` holds revision (default `HEAD`), history limit,
      ignore globs, analyze paths, enabled language plugins, enabled git
      metrics, commit convention and architecture rules; `PATCH /projects/:id`
      renames a project or re-points its root. Settings are stored sparsely and
      defaulted on read, and a plugin id nobody loaded is refused. `/analyze`
      over a registered root takes `rev` and `historyLimit` from here (an
      explicit request field still wins) — the remaining fields are stored and
      served but not yet honoured by the pipeline, which is the item below.
- [ ] **P0** Honour the rest of a project's config in the pipeline — ignore
      globs and analyze paths in the file routing, the enabled-plugin lists in
      `Strata.analyze`, and the chosen commit convention instead of
      first-registered-wins. (Architecture rules need the rule engine under
      *Architecture fitness*.)
- [ ] **P0** App-scoped config store + endpoints: appearance (theme, density),
      plugins directory, third-party plugin loading, cache on/off + clear,
      CI gate thresholds, AI provider instances.
- [ ] **P1** Secret storage for provider env values — write-only from the API's
      perspective; the mockup states *"sensitive values are stored separately and
      are not returned to the app after saving"*, so redact on read.
- [ ] **P1** Config precedence + a checked-in `strata.config.*` file so a project's
      scope, rules, and gates travel with the repo and drive headless CI mode.
- [ ] **P2** Import/export a project config; per-project overrides of app defaults.

## Git / history intelligence

- [x] Hotspots (churn × complexity)
- [ ] **P0** Commit analytics aggregates behind the *Commit analytics* screen —
      per-type and per-scope counts, convention-validity rate (`96% valid ·
      6 non-conforming`), breaking-change count, and a weekly activity series.
- [x] Change coupling — files that change together (temporal coupling).
      Thresholds (min changes/shared/degree) are still fixed constants; they
      become the *Project settings → Metrics* toggles.
- [ ] **P1** Knowledge map / bus factor — contribution concentration per file/dir
- [ ] **P1** Code age — stable vs. actively-churning regions
- [ ] **P1** Ignore-globs for metrics (exclude lockfiles/generated) — shares the
      project-scoped glob list with the language scan rather than a second setting.
- [ ] **P2** Author/ownership graph; main contributor per module
- [ ] **P2** Breaking-change timeline (the mockup shows a count; a timeline is the
      natural follow-up)

## Language modules

- [x] TypeScript/JavaScript starter (import graph + cycles)
- [x] **tree-sitter** instead of the regex scan — every file is parsed
      (WASM grammars, no native build), so imports, exports, dynamic `import()`
      and `require()` are read from the tree, and specifiers resolve through the
      project's own `tsconfig.json` `paths`/`baseUrl` aliases.
- [x] Workspace package resolution — `@strata/sdk` resolves to `packages/sdk`'s
      source, so a monorepo's cross-package imports are edges instead of every
      package looking like an island.
- [x] Real dead code — unreferenced exports, unreachable files, unused deps,
      in the mockup's shape (path, symbol, reason, line). Entry points are
      inferred (published `package.json` fields, npm scripts, tests, tool
      config); user-declared ones wait for per-project plugin settings.
- [x] Real metrics — cyclomatic complexity, max nesting depth and cross-file
      duplication per file, counted over the syntax tree rather than raw text.
- [ ] **P0** Graph summary in the language result — node/edge counts, cycle count,
      and fan-in/fan-out ranking (the mockup's *Max fan-in · sdk · 7* panel).
      The graph view computes this in the browser meanwhile
      (`apps/web/src/lib/graph/summary.ts`), which is what it stops doing.
- [ ] **P1** Emit each SCC as an ordered path so the UI can print the cycle as
      `a → b → a` instead of an unordered node set. Ordered in the browser for
      now (`apps/web/src/lib/graph/cycles.ts`).
- [ ] **P1** **Angular** module — component/module/service graph, DI graph, standalone vs NgModule, lazy boundaries, unused components
- [ ] **P1** **PHP** module — dependency graph + dead code
- [ ] **P2** Cross-language project graph (e.g. TS frontend ↔ PHP backend boundaries)

## Architecture fitness

- [ ] **P1** Rule engine — declare allowed/forbidden dependencies ("`ui` may not import `db`").
      The rules are persisted per project already (`/projects/:id/config`,
      `{from, to, enforced}`); what is missing is the check that reads them and
      the *Project settings → Architecture rules* screen that edits them.
- [ ] **P1** Boundary/layer violation report + CI gate
- [ ] **P2** Violations surfaced on the dependency graph (highlight the offending edge)
- [ ] **P2** Fitness-function trends over time

## AI

The mockup reframes this area: providers are **local CLI coding agents**
(Codex, Claude, Cursor) that Strata launches as subprocesses, not
OpenAI-compatible HTTP endpoints. The existing `AIProvider` contract in
`packages/sdk/src/ai.ts` (`listModels` / `chat` / `embed`) still fits as the
call surface, but everything about *configuring* an instance is new. Analysis
itself stays fully offline.

- [x] AI-provider contract + template (OpenAI-compatible / Ollama)
- [ ] **P1** CLI-agent provider kind — spawn and talk to a coding-agent binary;
      per-instance binary path, agent home path, shadow home (account-specific
      home that keeps `auth.json` separate while sharing state), launch args,
      env vars, and a model id list.
- [ ] **P1** Provider health checks — resolve the binary, read its version and
      auth state, list models; run on an interval (*Health check interval*,
      `0` = manual only) and expose the three states the mockup renders:
      *Ready*, *Not found*, *Disabled*.
- [ ] **P1** Provider registry UI — enable/disable, display name, accent colour,
      env vars, models, plus *Add custom provider*. See the Web UI section.
- [ ] **P1** "Explain this hotspot / module" action
- [ ] **P1** Natural-language query over the repo (RAG on the analysis DB + embeddings)
- [ ] **P2** PR/commit risk assessment
- [ ] **P2** Auto-generate/refresh architecture docs from the graphs

## Web UI (`apps/web`)

Design reference: *Strata Web UI* mockup. Design tokens are defined there for
both themes — dark and light palettes, `--h1…--h5` heat ramp, IBM Plex
Sans/Mono.

### Shell

- [x] Scaffold the frontend — Vite + SvelteKit (static SPA) + Tailwind v4, with
      the token set as the theme layer (`lib/theme/tokens.css`, both palettes,
      switchable dark / light / system), a typed REST client per endpoint, and
      IBM Plex self-hosted. The palette is derived from the mockup's
      description, so expect a tuning pass as screens land.
- [ ] **P0** App shell — left rail (logo, project switcher, analysis nav, plugin
      count, settings entries), sticky header (breadcrumb, branch + rev chips,
      last-run summary, *Re-analyze*), scrollable main pane
- [ ] **P0** Project switcher — dropdown listing registered projects with file
      count and last-analysis age, select / remove / *Add project* (which lands on
      *Project settings → Analyze / run* for the first analysis)
- [ ] **P1** Cycle count badge on the *Dependencies* nav item, driven by the last run
- [ ] **P1** Empty and error states — no projects registered, never analysed,
      analysis failed, plugin threw

### Analysis screens

- [ ] **P0** Overview — six stat cards (files, top hotspot, import cycles, commits,
      dead code, plugins), top-hotspot bar list, import-cycle alert card with the
      cycle path, loaded-plugins list, commit-type strip
- [x] Hotspot treemap (`/hotspots`) — heat legend, squarified tiles sized by
      score and coloured by complexity, the ranked table (churn / complexity /
      LOC / score), and a shared selection between the two. Runs the analysis
      from a repo-path form until the project switcher replaces it.
- [x] Dependency graph view (`/graph`) — an in-repo SVG layout, no Cytoscape/d3
      (`apps/web` decision 10), in the shape of **Nx's project graph**: uniform
      cards in ranks running down, what a card imports below it, folders as
      dashed containers laid out as units. Opens as one card per top-level folder and folders open and
      close from the canvas or the side panel — a closed one carries the imports
      behind it, counted. Pan and zoom. Cycle cards and edges highlighted; side
      panel with the SCC path and the graph summary (nodes, edges, cycles,
      max fan-in).
- [ ] **P1** Commit analytics view — by-type bars, breaking + validity stat cards,
      8-week activity chart, recent-commits table with `BREAKING` markers
- [ ] **P1** Dead code view — three summary cards and the findings table, now
      backed by real findings. Keep the mockup's *preview* banner until
      tree-sitter makes entry points and resolution exact.
- [ ] **P2** Drill-down: click a treemap tile or graph node → file detail
      (churn history, complexity, importers/imports, dead symbols)

### Project settings

- [ ] **P0** Settings shell — sidebar swaps to a settings nav with *Back to
      workbench*, scoped title, and section list
- [ ] **P0** General — display name, root path (read-only mount), revision, history limit
- [ ] **P0** Analyze / run — root, revision, history limit, the plugin chips that
      will run, *Run analysis* (`POST /analyze`), and a recents list
- [ ] **P1** Scope & ignore — ignore globs and analyze paths as editable chip lists
- [ ] **P1** Language plugins — per-project toggles with the extensions each one
      claims; *planned* modules (Angular, PHP) shown disabled
- [ ] **P1** Metrics & convention — metric toggles plus a
      `conventional` / `gitmoji` / `custom` convention selector
- [ ] **P1** Architecture rules — list and edit `X may not import Y` rules with an
      *enforced* marker
- [ ] **P1** Danger zone — remove the project from Strata (repo on disk untouched)

### Application settings

- [ ] **P1** Appearance — theme (dark / light / system) and density
      (dense / balanced / airy)
- [ ] **P1** Plugins & engine — plugins directory, third-party loading toggle,
      incremental cache toggle and *Clear cache*
- [ ] **P1** CI gates — fail on new import cycles, hotspot regression threshold
- [ ] **P1** AI providers — provider cards with enable toggle, expandable detail
      (display name, accent colour, env vars, binary path, home path, shadow home,
      launch args, models), health-check interval stepper, *Add custom provider*
- [ ] **P2** About — version, licence, links to docs / architecture / backlog
- [ ] **P2** Multi-repo workspace; saved views

## CI / delivery

- [x] CI (build/typecheck/lint/test), Conventional Commits enforcement (hook + CI)
- [x] release-please + multi-arch GHCR image + Linux desktop stub
- [ ] **P1** Headless CI mode — emit JSON/Markdown report, **fail on thresholds**
      (hotspot regression, new cycles, rule violations), reading the same gate
      config the *CI gates* screen edits
- [ ] **P1** Commit the pnpm lockfile and switch CI to `--frozen-lockfile`
- [ ] **P1** Serve the built web UI from `@strata/server` so the Docker image is a
      single deployable workbench
- [ ] **P2** Tauri desktop app under `apps/desktop` (enable the Linux release job)
- [ ] **P2** Add macOS/Windows to the desktop release matrix (+ signing)

## Docs & DX

- [x] arc42 architecture + per-module docs + Makefile + `analyze`/`new-plugin` scripts
- [ ] **P1** ADR folder (`docs/adr/`) — promote ADR-1…6 into standalone records
- [ ] **P1** ADR for the CLI-agent provider model (subprocess + shadow home +
      secret storage), since it supersedes the HTTP-provider assumption
- [ ] **P2** Example gallery / screenshots once the UI exists
