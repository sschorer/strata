# Module: `@strata/server` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **HTTP boundary**. A thin Fastify app that discovers first-party plugins,
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
| GET | `/plugins` | List loaded plugin manifests. |
| POST | `/analyze` | Body `{ root, rev?, historyLimit? }` → `AnalysisReport`. |

## 4. Building Blocks

| Piece | Responsibility |
|-------|----------------|
| `buildRegistry()` | Load the built-in plugin manifests (extend for user plugins). |
| `createServer()` | Construct the Fastify app + routes. |
| entry guard | Start listening when run directly (`node dist/index.js`). |

## 5. Runtime

Request → validate body → `Strata.analyze()` → JSON report. Plugin discovery
happens once at startup.

## 6. Decisions

- **Fastify** for schema-friendly, fast HTTP with low overhead.
- **Built-ins discovered from manifests** (not hard-wired imports), so adding a
  first-party plugin is a one-line list change; third-party dir loading is next.

## 7. Quality & Risks

- **Risk:** `root` points anywhere on disk. **Mitigation:** deployments mount
  repos read-only under a fixed prefix; add path allow-listing (backlog).
- **Risk:** long analyses block the event loop. **Mitigation:** move heavy runs
  to a worker queue (backlog).
