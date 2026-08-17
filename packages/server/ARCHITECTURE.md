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
- **Authentication:** `$STRATA_TOKEN`, if the deployment sets one. Every
  endpoint below except `/health` then needs
  `Authorization: Bearer <token>`; without it, or with the wrong one, the
  answer is `401` and a `WWW-Authenticate: Bearer realm="Strata"` header.
  Unset means an open API — the default, and what a workstation wants — said
  out loud in a warning at startup.
- **Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness. The one endpoint outside the token, so a probe can watch a container without holding a credential. |
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
| `app.ts` | `createServer()` — the token guard, settings, plugin registry, one `Strata`, one project store, routes, shutdown hook. |
| `main.ts` | Process entry point (`node dist/main.js`). |
| `registry.ts` | `buildRegistry(opts)` — load the built-ins, then the user plugins directory the settings name (unless third-party loading is off). |
| `auth/token.ts` | `configuredToken()` — the deployment's secret from `$STRATA_TOKEN`, or `undefined` for an open API. |
| `auth/hook.ts` | `requireToken()` — the `onRequest` hook that turns away anything but a liveness probe without the token. |
| `auth/presented.ts` | `presentedToken()` — the bearer credential a request carries, read from `Authorization` and nowhere else. |
| `auth/compare.ts` | `sameToken()` — constant-time comparison over two digests. |
| `auth/warning.ts` | `authWarning()` — what to say at startup about an open API, or a token short enough to guess. |
| `routes/health.ts` … `routes/settings.ts` | One module per endpoint. |
| `routes/http-error.ts` | `httpError(status, message)` — a thrown error Fastify serialises in its own error shape. |
| `routes/patch.ts` | `requirePatch()` — refuse a PATCH that changes nothing. |
| `routes/plugin-ids.ts` | `requireKnownPlugins()` — refuse settings naming a plugin nobody loaded. |
| `routes/allowed-root.ts` | `requireAllowedRoot()` / `rootError()` — confine a path from a request to `$STRATA_ROOTS`, and map the two refusals onto 403 and 404. The policy itself is the core's (`roots/`). |
| `routes/browse.ts` | `/browse` — hands `listDirectory()` a path and maps its refusals the same way. |
| `routes/index.ts` | `registerRoutes()` + the `RouteContext` they share. |

## 5. Runtime

Request → check the bearer token → validate body → confine the root to
`$STRATA_ROOTS` → `Strata.analyze()` → JSON report, plus a write to the project
registry when the analysed root is registered. Plugin discovery happens once at
startup, as does opening the registry and reading the token; the roots are read
per request, so widening them is a restart of nothing while rotating the token
is a restart.

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
- **One shared secret, opt-in, in front of everything but the probe** — this is
  one workbench with one owner, so a token is the whole of the credential; it
  lives in `$STRATA_TOKEN` beside `$STRATA_ROOTS`, because who may call and
  what may be reached are both facts about the deployment rather than rows in a
  database. It is checked in `onRequest`, the first hook of the lifecycle, so a
  caller without it never reaches a body parser or a path check; unrouted paths
  get the same 401, so the API is no way to ask which endpoints exist. Not
  setting one keeps today's open API, because Strata is mostly run on the
  machine it analyses — but startup says so, every time. `/health` stays open:
  a probe cannot hold a secret and learns nothing but whether the process is
  up.
- **The credential is read from `Authorization` only** — never a query
  parameter, which Fastify writes into its own request log and a browser writes
  into history and `Referer`; never a cookie, which the browser would attach to
  requests this app never made, turning an auth question into a CSRF one.
- **Auth and the allow-list answer different questions** — a caller holding the
  token is trusted, not unconfined, so `$STRATA_ROOTS` still bounds every path
  they name. The token decides whether a request is answered; the allow-list
  decides what it may reach.
- **Every path from a request passes through the same allow-list** — `root`
  would otherwise be "any directory this process can
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

- **Risk:** a deployment that sets no `$STRATA_TOKEN` answers anyone who can
  reach the port: `DELETE /cache` (cost: a recomputation),
  `DELETE /projects/:id` (cost: a registry entry, and nothing on disk), and
  `PATCH /settings`, which names a plugins directory the next start will load
  code from. **Mitigation:** set one — it is a single environment variable and
  every endpoint but `/health` is behind it. Startup warns while it is unset,
  and warns again if it is short enough to guess. An open API is still the
  default, so a port that was only ever meant to be local must not be published
  without one.
- **Note for cross-origin work:** a bearer header makes every call
  preflighted, and a browser sends `OPTIONS` without credentials. Nothing
  serves CORS today (the UI is same-origin, or proxied in dev), so nothing is
  broken — but whoever adds it has to let `OPTIONS` past the hook, or every
  cross-origin call fails its preflight with a 401.
- **Risk:** the token is a static shared secret with no expiry, and rotating it
  is a restart. Anyone holding it holds all of the API — there is no second
  credential to revoke on its own. **Mitigation:** enough for one self-hosted
  workbench, which is what this is; named, revocable keys are the shape to
  reach for if this ever serves more than one person. Transport is the
  deployment's job: over plain HTTP the token travels in clear text, so
  terminate TLS in front of it on anything but localhost.
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
