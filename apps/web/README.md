# @strata/web

The web UI (dashboards for hotspots, dependency graphs, commit analytics).

This is a **placeholder**. Scaffold the frontend of your choice here — the
recommendation in the design doc is Vite + SvelteKit (or Next.js) + Tailwind,
talking to `@strata/server` over REST. Suggested first views:

- **Hotspot treemap** — from `GET/POST /analyze` → the `metrics` series with
  `id: "hotspots"` (the report's `metrics` is an array of `MetricSeries`).
- **Change coupling** — the `metrics` series with `id: "change-coupling"`
  (pairs, degree in `%`).
- **Dependency graph** — from `languages[*].graph` (render with Cytoscape/d3).
- **Commit analytics** — from `commits[]` (types, scopes, breaking changes).
- **Settings** — register AI providers and API keys.

Wire `dev`/`build`/`typecheck` scripts once scaffolded so the root
`pnpm` scripts and CI pick it up automatically.
