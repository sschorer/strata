# Module: `@strata/server` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **HTTP boundary**. A thin Fastify app that discovers plugins — the
first-party ones plus whatever is installed in the user plugins directory —
wires them into a `Strata` instance, and exposes analysis over REST for the web
UI and CI. Keeps transport concerns out of the core.

## 2. Constraints

- Stateless request handling (state lives in the core: the cache, the project
  registry and the app settings).
- No business logic beyond validation + delegation to the core.
- Must run in the container as a non-root user.

## 3. Interfaces (Context)

- **Depends on:** `@strata/core`, `@strata/sdk`, Fastify.
- **Consumed by:** `apps/web`, CI, `curl`.
- **Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness. |
| GET | `/plugins` | What loaded, from where, and what was skipped: `{ directory, plugins, failures }` — each plugin its manifest plus a `source` (`builtin`/`user`). `directory` is the one actually scanned at startup. |
| GET | `/projects` | `{ projects }` — the registry, in registration order; each entry carries its id, display name, root and last-analysis summary. |
| POST | `/projects` | Body `{ name, root }` → the created `Project` (201). The root is confined to `$STRATA_ROOTS` (403 outside, 404 for a path inside them that is not a directory) and resolved to the repository that owns it — which has to be inside them too; 400 if it owns none, 409 if that repository is already registered. |
| GET | `/projects/:id` | One project, or 404. |
| PATCH | `/projects/:id` | Body `{ name?, root? }` → the updated `Project`. Identity only; same confinement, root resolution and 409 as `POST`. |
| DELETE | `/projects/:id` | Drop the entry and its config (`{ removed: true }`), or 404. Never touches the repository on disk. |
| GET | `/projects/:id/config` | That project's settings, filled out with the defaults. |
| PATCH | `/projects/:id/config` | Body: any of `rev`, `historyLimit`, `ignore`, `paths`, `languages`, `metrics`, `convention`, `rules` → the whole config. Merges by field; an array replaces. 400 on a value that cannot be stored or a plugin id nobody loaded. |
| GET | `/browse` | `?path=&hidden=` → `{ path, parent, repo, entries, roots }` — the subdirectories of one directory on the server's machine, each marked whether it is a git working tree. The folder picker behind *Add project*. Directory names only, and only inside `$STRATA_ROOTS` (default: the server user's home): 403 outside them, 404 for a path that is not a directory. |
| GET | `/settings` | The app-wide settings, filled out with the defaults: `{ appearance, engine, gates, ai }`. |
| PATCH | `/settings` | Body: any of those four sections → all of them. Merges two levels deep (section, then field); an array replaces. 400 on a value that cannot be stored, or on a section named with no field in it. |
| POST | `/analyze` | Body `{ root, rev?, historyLimit?, cache? }` → `AnalysisReport` (incl. run metadata and cache stats). The root is confined to `$STRATA_ROOTS` first: 403 outside them, 404 for a path inside them that is not a directory. Over a registered root, the project's config supplies the defaults (`rev`, `historyLimit`) and its scope, plugin lists and convention outright, and the run updates its last-analysis summary; the cache default comes from the app settings. |
| DELETE | `/cache` | Empty the incremental cache — the *Clear cache* button, which is an action rather than a setting. Registered projects and app settings are untouched: both live in their own databases. |

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | Barrel — the package's public surface. |
| `app.ts` | `createServer()` — settings, plugin registry, one `Strata`, one project store, routes, shutdown hook. |
| `main.ts` | Process entry point (`node dist/main.js`). |
| `registry.ts` | `buildRegistry(opts)` — load the built-ins, then the user plugins directory the settings name (unless third-party loading is off). |
| `routes/health.ts` … `routes/settings.ts` | One module per endpoint. |
| `routes/http-error.ts` | `httpError(status, message)` — a thrown error Fastify serialises in its own error shape. |
| `routes/patch.ts` | `requirePatch()` — refuse a PATCH that changes nothing. |
| `routes/plugin-ids.ts` | `requireKnownPlugins()` — refuse settings naming a plugin nobody loaded. |
| `routes/allowed-root.ts` | `requireAllowedRoot()` / `rootError()` — confine a path from a request to `$STRATA_ROOTS`, and map the two refusals onto 403 and 404. The policy itself is the core's (`roots/`). |
| `routes/browse.ts` | `/browse` — hands `listDirectory()` a path and maps its refusals the same way. |
| `routes/index.ts` | `registerRoutes()` + the `RouteContext` they share. |

## 5. Runtime

Request → validate body → confine the root to `$STRATA_ROOTS` →
`Strata.analyze()` → JSON report, plus a write to the project registry when the
analysed root is registered. Plugin discovery happens once at startup, as does
opening the registry; the roots are read per request, so widening them is a
restart of nothing.

## 6. Decisions

- **Fastify** for schema-friendly, fast HTTP with low overhead.
- **Built-ins discovered from manifests** (not hard-wired imports), so adding a
  first-party plugin is a one-line list change. Built-ins load first, then
  `STRATA_PLUGINS_DIR`, so a drop-in third-party plugin can extend Strata but
  never shadow a first-party id.
- **A plugin that will not load never fails startup** — it is reported on
  `GET /plugins` instead, which is what the plugins settings screen reads.
- **One long-lived `Strata`**, so the cache is opened once and closed with the
  server (`onClose`), not per request. The project store and the settings store
  are opened and closed the same way.
- **Settings are read before plugins are loaded** — *Plugins & engine* decides
  which directory is scanned and whether drop-in plugins are loaded at all, and
  loading happens exactly once, at startup. So `createServer()` opens the
  settings first, and `/plugins` reports the directory that was actually
  scanned rather than the one a setting has been changed to since: a pending
  change should read as pending, not as history.
- **A setting is honoured where its consumer already exists**, and stored
  otherwise. The cache toggle is a per-run default on `/analyze`, the plugin
  settings are read at startup — appearance, the CI gates and the AI providers
  are served to a shell, a headless CI mode and a provider runtime that are
  still being built, and the backlog says so rather than the API pretending.
- **`/analyze` refreshes the registry itself** — the switcher shows how long ago
  each project was analysed, and a run over a registered root is that fact,
  whoever asked for it. No `projectId` in the request body, so a CI run and a
  click through the UI keep the same entry current. A registry that will not
  take the update is logged, never raised: the caller already paid for the
  report.
- **A project's config is the default for a run over it**, not a constraint on
  it: `/analyze` fills in `rev` and `historyLimit` from the settings and lets an
  explicit request field win, so *Re-analyze* follows *Project settings* while a
  CI job asking for a revision still gets that revision.
- **…except for what describes the project rather than the run.** The scope
  (analyse paths, ignore globs), the enabled-plugin lists and the commit
  convention reach the core from the config with no request field to override
  them. A revision is a question you ask of a repository; a scope is part of
  what the repository *is* to this workbench, and a caller wanting a different
  one is describing a different project. Keeping them off the request body also
  keeps two reports of the same project comparable.
- **Settings are two resources, split by who can promise what** — `/projects/:id`
  owns identity (the root has to stay unique across projects), `/projects/:id/config`
  owns what an analysis does. One PATCH each, merging by field.
- **Plugin selections are checked against the registry as they are written** —
  the screens only offer loaded plugins, so an id that is not one is a typo or a
  stale client, and stored silently it would look like a plugin that is switched
  on but never runs.
- **Every path from a request passes through the same allow-list** — the API is
  unauthenticated, so `root` would otherwise be "any directory this process can
  read": `GET /browse` a filesystem enumerator, `POST /analyze` a way to walk
  someone else's repository through it. `$STRATA_ROOTS` (the server user's home
  by default, `/repos` in the container) says what may be reached, one
  `requireAllowedRoot()` at the top of each handler applies it, and the
  *resolved* path is what the handler goes on to use — so a symlink cannot
  point the run somewhere the check never saw. Browsing adds its own limits on
  top: no file names, no content.
- **Registering checks both ends** — the path that arrived and the repository
  git resolves it to. A subdirectory inside a root can belong to a working tree
  that starts above one, and registering that would hand every later analysis a
  tree this deployment said no to.
- **Registering a project resolves the path through git**, so a path that is no
  repository is a 400 at *Add project* rather than a failure at the first
  analysis, and a subdirectory registers the repository that owns it instead of
  a second entry for a project that is already there.

## 7. Quality & Risks

- **Risk:** the API is unauthenticated, so everything it can do is reachable by
  anyone who can reach the port: `DELETE /cache` (cost: a recomputation),
  `DELETE /projects/:id` (cost: a registry entry, and nothing on disk), and
  `PATCH /settings`, which names a plugins directory the next start will load
  code from. **Mitigation:** paths are allow-listed (below), but the rest is
  not — the API assumes a trusted network and auth is on the backlog. Do not
  expose the port publicly.
- **Risk:** `POST /analyze` and `POST /projects` take a path from the caller,
  and `GET /browse` discloses directory *names*. **Mitigation:**
  `$STRATA_ROOTS` — the server user's home by default, the read-only `/repos`
  mount in the container — confines all three, symlinks are resolved before the
  check, and a browse answer lists no files. Narrow it to the directory your
  repositories live in on a shared host; the default is only reasonable on a
  workstation.
- **Risk:** AI provider `env` values are stored and served in plain text.
  **Mitigation:** secret storage is the next item in that area; until it lands,
  nothing sensitive belongs in provider settings.
- **Risk:** malformed request bodies. **Mitigation:** `/analyze` carries a JSON
  schema, so a wrong-typed field (`"cache": "false"`) is a 400 rather than a
  silently ignored option.
- **Risk:** long analyses block the event loop. **Mitigation:** move heavy runs
  to a worker queue (backlog).
