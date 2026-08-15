# Module: `@strata/server` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **HTTP boundary**. A thin Fastify app that discovers plugins — the
first-party ones plus whatever is installed in the user plugins directory —
wires them into a `Strata` instance, and exposes analysis over REST for the web
UI and CI. Keeps transport concerns out of the core.

## 2. Constraints

- Stateless request handling (state lives in the core/cache).
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
| POST | `/analyze` | Body `{ root, rev?, historyLimit?, cache? }` → `AnalysisReport` (incl. run metadata and cache stats). |
| DELETE | `/cache` | Empty the incremental cache. |

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | Barrel — the package's public surface. |
| `app.ts` | `createServer()` — registry, one `Strata`, routes, shutdown hook. |
| `main.ts` | Process entry point (`node dist/main.js`). |
| `registry.ts` | `buildRegistry()` — load the built-ins, then the user plugins directory. |
| `routes/health.ts` … `routes/cache.ts` | One module per endpoint. |
| `routes/index.ts` | `registerRoutes()` + the `RouteContext` they share. |

## 5. Runtime

Request → validate body → `Strata.analyze()` → JSON report. Plugin discovery
happens once at startup.

## 6. Decisions

- **Fastify** for schema-friendly, fast HTTP with low overhead.
- **Built-ins discovered from manifests** (not hard-wired imports), so adding a
  first-party plugin is a one-line list change. Built-ins load first, then
  `STRATA_PLUGINS_DIR`, so a drop-in third-party plugin can extend Strata but
  never shadow a first-party id.
- **A plugin that will not load never fails startup** — it is reported on
  `GET /plugins` instead, which is what the plugins settings screen reads.
- **One long-lived `Strata`**, so the cache is opened once and closed with the
  server (`onClose`), not per request.

## 7. Quality & Risks

- **Risk:** `root` points anywhere on disk, and the API is unauthenticated —
  `DELETE /cache` is reachable by anyone who can reach the port (cost: a
  recomputation). **Mitigation:** the API assumes a trusted network and
  deployments mount repos read-only under a fixed prefix; path allow-listing and
  auth are on the backlog. Do not expose the port publicly.
- **Risk:** malformed request bodies. **Mitigation:** `/analyze` carries a JSON
  schema, so a wrong-typed field (`"cache": "false"`) is a 400 rather than a
  silently ignored option.
- **Risk:** long analyses block the event loop. **Mitigation:** move heavy runs
  to a worker queue (backlog).
