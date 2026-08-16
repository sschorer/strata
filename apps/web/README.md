# @strata/web

The Strata web UI — dashboards for hotspots, dependency graphs, commit
analytics, and the project/app settings screens.

**Stack:** Vite + SvelteKit (Svelte 5 runes) + Tailwind CSS v4, built as a
static SPA with `@sveltejs/adapter-static`. It talks to `@strata/server` over
REST only.

## Run it

```bash
make dev        # terminal 1 — the API on :4000
make web        # terminal 2 — the UI on :5173
```

The dev server proxies the API paths (`/health`, `/plugins`, `/analyze`,
`/cache`) to `http://localhost:4000`, so the UI uses the same relative URLs in
dev as in production, where the server serves this build itself. Two knobs:

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `STRATA_API_PROXY` | dev server | `http://localhost:4000` | Where Vite forwards API calls |
| `VITE_STRATA_API` | build | *(empty = same origin)* | Absolute API origin to bake into the build (needs CORS) |

Other targets: `pnpm --filter @strata/web build` (writes `build/`),
`preview`, `typecheck` (`svelte-check`) and `test`.

## Tests

`vitest` with the plain Svelte plugin and a `happy-dom` environment, configured
in `vitest.config.ts`. The root `vitest.config.ts` pulls it in as a second
project, so `make test` at the repo root runs the UI suite alongside the Node
one — and `pnpm --filter @strata/web test` runs just this app.

Components are mounted with `lib/test/render` and asserted against the DOM;
there is no testing-library layer to learn.

## Layout

```
src/
  app.html            document shell + the pre-paint theme bootstrap
  app.css             Tailwind entry: fonts, token → theme mapping, base layer
  lib/
    theme/            tokens.css (both palettes) + the appearance controller
    api/              one module per endpoint over a shared request helper
    analysis/         the last report, held app-wide, + the form that runs one
    plugins/          what the workbench loaded, fetched once for the app
    shell/            the workbench frame: rail, sticky header, scrolling pane
    format/           compact numbers, repo paths, durations and ages
    geometry/         squarify — the treemap layout
    hotspots/         the hotspot feature: report → rows, heat, views
    graph/            the dependency feature: folder tree, collapse, rank, layered, views
    components/       reusable UI pieces
    test/             test helpers (component mounting, graph fixtures)
  routes/             SvelteKit routes (SPA: `ssr = false`)
static/               favicon and anything else served verbatim
```

## Theming

`lib/theme/tokens.css` holds the mockup's palette twice — dark and light —
keyed on `data-theme` on `<html>`. `app.css` maps those `--strata-*` variables
onto Tailwind theme keys with `@theme inline`, so components only ever use
semantic utilities:

- surfaces — `bg-bg`, `bg-surface`, `bg-elevated`, `border-line`, `border-line-strong`
- text — `text-ink`, `text-muted`, `text-subtle`
- accent & status — `accent`, `accent-soft`, `accent-ink`, `ok`, `warn`, `danger`
- heat ramp — `h1` (cold) … `h5` (hot), for the hotspot treemap and its legend

Never write a literal colour in a component; add a token instead. The
appearance switch offers *dark / light / system*, remembers the choice in
`localStorage`, and follows the OS while the app is open. An inline script in
`app.html` applies the same choice before first paint — it duplicates the
storage key on purpose, so keep the two in step.

## Status

The theme layer, the typed API client, the app shell and the first two analysis
screens:

- **The shell** (`lib/shell`) — a left rail (logo, the current project, the
  analysis nav, the settings entries and the plugin count), a header that
  sticks to the content column (breadcrumb, branch and revision chips, the last
  run's files/duration/age, *Re-analyze*, appearance), and one scrolling main
  pane. Screens that are on the backlog are listed in the nav, disabled, so the
  map of the workbench is complete. Below `md` the rail gives way to a nav
  strip in the header.
- **Hotspots** (`/hotspots`) — a squarified treemap sized by score and coloured
  by complexity, its heat legend, and the ranked table.
- **Dependencies** (`/graph`) — the import graph as uniform cards in ranks, in
  the shape of Nx's project graph: what a card imports sits below it, so every
  arrow points one way. It opens as one card per top-level folder — the
  architecture — and opening a folder lays its contents out inside a dashed
  container. Folders open and close from the canvas or the side panel; a closed
  one carries the imports behind it, counted. Drag to pan, scroll to zoom. The
  side panel carries the graph summary (nodes, edges, cycles, max fan-in) and
  every cycle as a path, `a.ts → b.ts → a.ts`. Selecting a card lights up its
  neighbourhood; selecting a cycle lights up the knot.

Until the project switcher lands, the repo to analyse is typed into the form on
those pages and remembered in `localStorage`; the rail names it and the header
re-runs it.

The project switcher and the remaining analysis and settings screens are next —
see [`BACKLOG.md`](../../BACKLOG.md) and the *web-ui* issues.

Where each screen's data comes from:

| View | Source in the report |
|------|----------------------|
| Hotspot treemap | `metrics.find((m) => m.id === 'hotspots')` |
| Change coupling | `metrics.find((m) => m.id === 'change-coupling')` |
| Dependency graph | `languages[*].graph` |
| Dead code | `languages[*].deadCode` |
| Commit analytics | `commits[]` (type / scope / breaking) |
| Plugins settings | `GET /plugins` |
