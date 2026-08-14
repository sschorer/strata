# Module: `@strata/web` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Status: **placeholder** — to be scaffolded.

## 1. Purpose & Goals

The **web UI**: dashboards that turn an `AnalysisReport` into hotspot treemaps,
dependency graphs, and commit analytics, plus a settings screen for AI
providers. The face of Strata for browser/self-host use.

## 2. Constraints

- Talks to `@strata/server` over REST only (no direct core import).
- Must render in a browser and, later, inside the Tauri desktop shell.
- Theme-aware, responsive.

## 3. Interfaces (Context)

- **Depends on:** `@strata/server` REST API (`/analyze`, `/plugins`, `/health`).
- **Consumed by:** end users (browser / desktop).

## 4. Building Blocks (planned)

| View | Source in report |
|------|------------------|
| Hotspot treemap | `metrics.find((m) => m.id === "hotspots")` |
| Change coupling | `metrics.find((m) => m.id === "change-coupling")` (pair list / chord) |
| Dependency graph | `languages[*].graph` (Cytoscape/d3) |
| Commit analytics | `commits[]` (type/scope/breaking) |
| Settings | AI provider registration |

## 5. Runtime

User triggers an analysis → UI POSTs `/analyze` → renders the returned report.

## 6. Decisions

- **Recommended stack:** Vite + SvelteKit (or Next.js) + Tailwind — see the
  design discussion. Deliberately un-scaffolded so the choice stays open.

## 7. Quality & Risks

- **Risk:** graph rendering perf on large repos. **Mitigation:** virtualise /
  cluster nodes; render server-computed summaries first.
- **Debt:** everything — this module is a stub. See the backlog.
