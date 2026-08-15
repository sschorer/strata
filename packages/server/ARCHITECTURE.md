# Module: `@strata/server` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **HTTP boundary**. A thin Fastify app that discovers plugins — the
first-party ones plus whatever is installed in the user plugins directory —
wires them into a `Strata` instance, and exposes analysis over REST for the web
UI and CI. Keeps transport concerns out of the core.

## 2. Constraints

- Stateless request handling (state lives in the core: the cache and the
  project registry).
- No business logic beyond validation + delegation to the core.
- Must run in the container as a non-root user.

## 3. Interfaces (Context)

- **Depends on:** `@strata/core`, `@strata/sdk`, Fastify.
- **Consumed by:** `apps/web`, CI, `curl`.
- **Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness. |
| GET | `/plugins` | What loaded, from where, and what was skipped: `{ directory, plugins, failures }` — each plugin its manifest plus a `source` (`builtin`/`user`). |
| GET | `/projects` | `{ projects }` — the registry, in registration order; each entry carries its id, display name, root and last-analysis summary. |
| POST | `/projects` | Body `{ name, root }` → the created `Project` (201). The root is resolved to the repository that owns it; 400 if it owns none, 409 if that repository is already registered. |
| GET | `/projects/:id` | One project, or 404. |
| DELETE | `/projects/:id` | Drop the entry (`{ removed: true }`), or 404. Never touches the repository on disk. |
| POST | `/analyze` | Body `{ root, rev?, historyLimit?, cache? }` → `AnalysisReport` (incl. run metadata and cache stats). A run over a registered root also updates that project's last-analysis summary. |
| DELETE | `/cache` | Empty the incremental cache. Registered projects are untouched — they live in their own database. |

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | Barrel — the package's public surface. |
| `app.ts` | `createServer()` — plugin registry, one `Strata`, one project store, routes, shutdown hook. |
| `main.ts` | Process entry point (`node dist/main.js`). |
| `registry.ts` | `buildRegistry()` — load the built-ins, then the user plugins directory. |
| `routes/health.ts` … `routes/projects.ts` | One module per endpoint. |
| `routes/http-error.ts` | `httpError(status, message)` — a thrown error Fastify serialises in its own error shape. |
| `routes/index.ts` | `registerRoutes()` + the `RouteContext` they share. |

## 5. Runtime

Request → validate body → `Strata.analyze()` → JSON report, plus a write to the
project registry when the analysed root is registered. Plugin discovery happens
once at startup, as does opening the registry.

## 6. Decisions

- **Fastify** for schema-friendly, fast HTTP with low overhead.
- **Built-ins discovered from manifests** (not hard-wired imports), so adding a
  first-party plugin is a one-line list change. Built-ins load first, then
  `STRATA_PLUGINS_DIR`, so a drop-in third-party plugin can extend Strata but
  never shadow a first-party id.
- **A plugin that will not load never fails startup** — it is reported on
  `GET /plugins` instead, which is what the plugins settings screen reads.
- **One long-lived `Strata`**, so the cache is opened once and closed with the
  server (`onClose`), not per request. The project store is opened and closed
  the same way.
- **`/analyze` refreshes the registry itself** — the switcher shows how long ago
  each project was analysed, and a run over a registered root is that fact,
  whoever asked for it. No `projectId` in the request body, so a CI run and a
  click through the UI keep the same entry current. A registry that will not
  take the update is logged, never raised: the caller already paid for the
  report.
- **Registering a project resolves the path through git**, so a path that is no
  repository is a 400 at *Add project* rather than a failure at the first
  analysis, and a subdirectory registers the repository that owns it instead of
  a second entry for a project that is already there.

## 7. Quality & Risks

- **Risk:** `root` points anywhere on disk, and the API is unauthenticated —
  `DELETE /cache` is reachable by anyone who can reach the port (cost: a
  recomputation), and so is `DELETE /projects/:id` (cost: a registry entry, and
  nothing on disk). **Mitigation:** the API assumes a trusted network and
  deployments mount repos read-only under a fixed prefix; path allow-listing and
  auth are on the backlog. Do not expose the port publicly.
- **Risk:** malformed request bodies. **Mitigation:** `/analyze` carries a JSON
  schema, so a wrong-typed field (`"cache": "false"`) is a 400 rather than a
  silently ignored option.
- **Risk:** long analyses block the event loop. **Mitigation:** move heavy runs
  to a worker queue (backlog).
