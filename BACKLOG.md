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
- [x] Path allow-listing / sandbox for the `root` a request may analyse —
      `$STRATA_ROOTS` (`PATH`-separated, the server user's home by default,
      `/repos` in the image) is one allow-list for every path a request names:
      what `/browse` lists, what `/projects` registers or re-points to, and what
      `/analyze` walks. Symlinks are resolved before the check and the resolved
      path is what runs; registering checks the repository git resolves to as
      well as the path that arrived. 403 outside, 404 for a non-directory
      inside. `$STRATA_BROWSE_ROOTS` is still read as the former name. The
      allow-list says *what* may be reached; *who* may reach it is the auth item
      below.
- [x] Authentication for the HTTP API — `$STRATA_TOKEN` is one shared secret
      for the workbench, sent as `Authorization: Bearer <token>` and checked in
      `onRequest`, before a body is parsed or a path resolved; everything but
      `/health` answers 401 without it, unrouted paths included, so the API is
      no way to ask which endpoints exist. Compared in constant time and read
      from the header alone — a token in a query string lands in the request
      log. Leaving it unset keeps the open API, which is what the machine being
      analysed wants, and startup says so every time (and says so again for a
      token short enough to guess). The allow-list still bounds every path a
      caller names: holding the token makes them trusted, not unconfined. The
      web UI asks for the token once and keeps it in the browser.
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
      explicit request field still wins) and the rest of the config outright,
      which is the item below.
- [x] Honour the rest of a project's config in the pipeline — the analyse paths
      and ignore globs narrow the tracked files once, before any plugin sees
      them, so the plugins, the file count the report prints and every cache key
      describe the same set; the enabled-plugin lists are allow-lists in
      `Strata.analyze` (nothing named is every plugin, an empty list is none);
      and the chosen commit convention parses instead of first-registered-wins,
      parsing nothing rather than falling back when a project names one nobody
      loaded. These describe the project rather than one run, so `/analyze` has
      no request field to override them. *Analyze / run* reads the same rule, so
      its plugin chips answer per project. (Architecture rules need the rule
      engine under *Architecture fitness*.)
- [x] App-scoped config store + endpoints — `GET`/`PATCH` `/settings` holds
      appearance (theme, density), the plugins directory, third-party plugin
      loading, the incremental cache toggle, the CI gate thresholds and the AI
      provider instances, in `settings.db` (`$STRATA_DATA_DIR`, its own
      database beside the registry). Stored sparsely and defaulted on read like
      a project's config; a `PATCH` merges by section and then by field, so one
      settings screen can send back only what it edits. Every setting whose
      consumer already exists is honoured: the cache toggle is the default for
      the next `/analyze`, and the plugins directory and third-party switch are
      read when the server starts, which is when plugins load. *Clear cache*
      stays `DELETE /cache` — an action, not a setting. Appearance, the gates
      and the providers are stored and served for the screens below.
- [ ] **P1** Secret storage for provider env values — write-only from the API's
      perspective; the mockup states *"sensitive values are stored separately and
      are not returned to the app after saving"*, so redact on read. Until this
      lands, `ai.providers[].env` on `/settings` is stored and served as
      written, so nothing sensitive belongs in it.
- [ ] **P1** Config precedence + a checked-in `strata.config.*` file so a project's
      scope, rules, and gates travel with the repo and drive headless CI mode.
- [ ] **P2** Run history per project — the registry keeps the *last* run of each
      project, so *Analyze / run*'s recents list is the browser's own log
      seeded with that one summary. A handful of runs kept server-side would
      make it the same list on every machine, and is what a trend delta between
      two runs would read.
- [ ] **P2** Import/export a project config; per-project overrides of app defaults.

## Git / history intelligence

- [x] Hotspots (churn × complexity)
- [x] Commit analytics aggregates behind the *Commit analytics* screen —
      per-type and per-scope counts, convention-validity rate (`96% valid ·
      6 non-conforming`), breaking-change count, and a weekly activity series.
      The core folds them once, onto `report.commitAnalytics`, rather than
      leaving every reader to walk the log its own way; the weeks are
      Monday-started (UTC) and contiguous, so a quiet week is a zero and not a
      gap. The *Commit analytics* screen reads them as it lands.
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
- [x] Graph summary in the language result — every `LanguageAnalysis` carries
      node/edge counts, the cycle count and the files those cycles hold, and the
      busiest node in each direction (the mockup's *Max fan-in · sdk · 7*
      panel). `summariseGraph` in the SDK counts it, so every language module
      reports the same numbers; a result that arrives without one — a plugin
      built against an older SDK, or a run it cached back then — is summarised
      by the core. The graph view stopped computing it in the browser:
      `apps/web/src/lib/graph/summary.ts` now only adds the languages up.
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
- [ ] **P1** CLI-agent provider kind — spawn and talk to a coding-agent binary.
      The per-instance declaration (binary path, agent home path, shadow home —
      the account-specific home that keeps `auth.json` separate while sharing
      state — launch args, env vars and a model id list) is persisted already,
      behind `/settings` `ai.providers`; launching it is what is missing.
- [ ] **P1** Provider health checks — resolve the binary, read its version and
      auth state, list models; run on the stored interval
      (`/settings` `ai.healthCheckInterval`, `0` = manual only) and expose the
      three states the mockup renders: *Ready*, *Not found*, *Disabled*.
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
- [x] App shell (`lib/shell`) — left rail (logo, the analysed project, the
      analysis nav, the settings entries, the plugin count), a header that
      sticks to the content column (breadcrumb, branch + rev chips, the last
      run's files / duration / age, *Re-analyze*, appearance), and one
      scrolling main pane. Screens still on this list are in the nav, disabled,
      so the map of the workbench is whole; below `md` the rail gives way to a
      nav strip in the header. The project slot is the switcher's, below.
- [x] Project switcher — the rail slot (and, below `md`, the header's) is a
      dropdown over the registered projects, each with the file count and age of
      its last run: select, remove (registry only — the repo on disk is
      untouched), *Add project*. Picking a project points the workbench at it
      and drops a report belonging to another one. *Add project* lands on the
      new project, and a project that has never been analysed is pointed at
      *Project settings → Analyze / run*, which owns the run. It replaces the
      repo-path form the hotspot and dependency screens used to carry. *Add
      project* also
      browses: `GET /browse` walks the server's folders inside `STRATA_ROOTS`
      and marks which are repositories.
- [ ] **P1** Cycle count badge on the *Dependencies* nav item, driven by the last run
- [ ] **P1** Empty and error states — no projects registered, never analysed,
      analysis failed, plugin threw

### Analysis screens

- [x] Overview (`/`) — six stat cards (files, top hotspot, import cycles,
      commits, dead code, plugins), top-hotspot bar list, import-cycle alert
      card with the cycle path, loaded-plugins list, commit-type strip. The
      hotspot and cycle cards link to the screens that show those numbers in
      full; the commit types are a bar list rather than a stacked strip, because
      the palette is a heat ramp with no categorical set (`apps/web` decision
      26). Reads the run the project switcher's project last had, and lists the
      loaded plugins even before one.
- [x] Hotspot treemap (`/hotspots`) — heat legend, squarified tiles sized by
      score and coloured by complexity, the ranked table (churn / complexity /
      LOC / score), and a shared selection between the two. Reads the run the
      project switcher's project last had.
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

- [x] Settings shell — `/settings/project` and `/settings/app`. Inside either
      one the rail (and, below `md`, the header's strip) swaps the switcher and
      the analysis nav for that scope's nav: *Back to workbench*, the scope's
      title over what it applies to — the project and its root, or the
      workbench — and the section list. The landing screen of each scope prints
      the same sections with a line on what each one holds. Sections still on
      this list are listed disabled, as the analysis screens are.
- [x] General — `/settings/project/general`. The display name renames the
      registry entry (`PATCH /projects/:id`) and the revision and history limit
      are written to the project's config (`PATCH /projects/:id/config`), which
      every run over that root already honours; the reader sees one form and
      only the half they edited is sent. The root is printed as a read-only
      mount: re-pointing an entry would keep its name, settings and last run
      while all three now described another repository, so moving a project is
      remove-and-add-again.
- [x] Analyze / run — `/settings/project/analyze`. The root, revision and
      history limit a run reads, printed rather than edited (*General* owns
      them, and this is where they are used); the plugins that will take part
      as chips, with a line for every loaded plugin that stands by and why —
      the orchestrator's own rule, read against this project's config, so a
      plugin it leaves out stands by, the convention it chose parses and an AI
      provider never runs; *Run analysis* (`POST /analyze`); and the
      recent runs. Strata keeps one run summary per project, so the list is
      this browser's own log seeded with the registry's last one. The switcher
      no longer carries the first run; it links here.
- [ ] **P1** Scope & ignore — ignore globs and analyze paths as editable chip
      lists. The pipeline honours both already, so this is the editor for a
      field that works.
- [ ] **P1** Language plugins — per-project toggles with the extensions each one
      claims; *planned* modules (Angular, PHP) shown disabled. The allow-list is
      honoured; this writes it.
- [ ] **P1** Metrics & convention — metric toggles plus a
      `conventional` / `gitmoji` / `custom` convention selector. Both are
      honoured; this writes them.
- [ ] **P1** Architecture rules — list and edit `X may not import Y` rules with an
      *enforced* marker
- [ ] **P1** Danger zone — remove the project from Strata (repo on disk
      untouched); the switcher already does this, so this is the second door to it

### Application settings

- [ ] **P1** Appearance — theme (dark / light / system) and density
      (dense / balanced / airy). Persisted per workbench behind
      `/settings` `appearance`; the shell still reads the theme from
      `localStorage`, which is what this screen replaces.
- [ ] **P1** Plugins & engine — plugins directory, third-party loading toggle,
      incremental cache toggle and *Clear cache*. All four are wired
      (`/settings` `engine`, plus `DELETE /cache`); the screen is what is left.
- [ ] **P1** CI gates — fail on new import cycles, hotspot regression threshold.
      Stored behind `/settings` `gates`; headless CI mode is what reads them.
- [ ] **P1** AI providers — provider cards with enable toggle, expandable detail
      (display name, accent colour, env vars, binary path, home path, shadow home,
      launch args, models), health-check interval stepper, *Add custom provider*.
      Every field is persisted behind `/settings` `ai` already; what is missing
      is the screen and the runtime that launches what it describes.
- [ ] **P2** About — version, licence, links to docs / architecture / backlog
- [ ] **P2** Multi-repo workspace; saved views

## CI / delivery

- [x] CI (build/typecheck/lint/test), Conventional Commits enforcement (hook + CI)
- [x] release-please + multi-arch GHCR image + Linux desktop stub
- [ ] **P1** Headless CI mode — emit JSON/Markdown report, **fail on thresholds**
      (hotspot regression, new cycles, rule violations), reading the gate
      config the *CI gates* screen edits — `/settings` `gates` holds it, and
      nothing reads it yet
- [ ] **P1** Commit the pnpm lockfile and switch CI to `--frozen-lockfile`
- [ ] **P1** Serve the built web UI from `@strata/server` so the Docker image is a
      single deployable workbench. The static files go outside `$STRATA_TOKEN`
      (a browser has to load the app before it can be asked for the token);
      every API path under them stays behind it.
- [ ] **P2** Tauri desktop app under `apps/desktop` (enable the Linux release job)
- [ ] **P2** Add macOS/Windows to the desktop release matrix (+ signing)

## Docs & DX

- [x] arc42 architecture + per-module docs + Makefile + `analyze`/`new-plugin` scripts
- [ ] **P1** ADR folder (`docs/adr/`) — promote ADR-1…6 into standalone records
- [ ] **P1** ADR for the CLI-agent provider model (subprocess + shadow home +
      secret storage), since it supersedes the HTTP-provider assumption
- [ ] **P2** Example gallery / screenshots once the UI exists
