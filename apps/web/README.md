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
`/cache`, `/projects`, `/browse`) to `http://localhost:4000`, so the UI uses
the same relative URLs in dev as in production, where the server serves this
build itself. Two knobs:

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
    analysis/         the last report, held app-wide, and the repo it ran over
    projects/         the registered projects and the switcher over them
    plugins/          what the workbench loaded, fetched once for the app
    shell/            the workbench frame: rail, sticky header, scrolling pane
    settings/         the settings frame: the two scopes, their sections, the rail in settings mode
    format/           compact numbers, repo paths, durations and ages
    geometry/         squarify — the treemap layout
    overview/         the overview feature: stat cards, hotspot bars, cycles, plugins, commit types
    hotspots/         the hotspot feature: report → rows, heat, views
    graph/            the dependency feature: folder tree, collapse, rank, layered, views
    components/       reusable UI pieces
    test/             test helpers (component mounting, graph fixtures, API stubs)
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

The theme layer, the typed API client, the app shell, the project switcher, the
analysis screens built so far and the settings shell:

- **The shell** (`lib/shell`) — a left rail (logo, the project switcher, the
  analysis nav, the settings entries and the plugin count), a header that
  sticks to the content column (breadcrumb, branch and revision chips, the last
  run's files/duration/age, *Re-analyze*, appearance), and one scrolling main
  pane. Screens that are on the backlog are listed in the nav, disabled, so the
  map of the workbench is complete. Below `md` the rail gives way to a nav
  strip in the header.
- **The project switcher** (`lib/projects`) — the rail's project slot is a
  dropdown over the registered projects (`GET /projects`), each with the file
  count and age of its last run. Picking one points the whole workbench at it;
  *Add project* registers a repository from any path inside it — typed, or
  found with the folder browser, which walks the server's directories
  (`GET /browse`) and marks which ones are repositories — and the × removes the
  entry from Strata without touching the repository on disk. Below `md`, where
  there is no rail, the header carries the same switcher.

  What the browser may reach is `STRATA_BROWSE_ROOTS` on the server (the server
  user's home by default, `/repos` in the container); it lists directory names
  only.
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
- **Settings** (`lib/settings`) — two scopes, `/settings/project` and
  `/settings/app`. Opening either swaps the rail (and, below `md`, the header's
  strip) for that scope's nav: *Back to workbench*, the scope's heading over
  what it applies to — the project and its root, or the workbench — and the
  section list. Each scope's landing screen prints the same sections with a
  line on what each one holds. The sections themselves are still to build, so
  they are listed disabled, as the analysis screens on the backlog are.

A repository is named once, in *Add project*; the screens then read whatever
run the selected project last had, the header's *Re-analyze* repeats it, and a
project that has never been analysed is offered its first run in the switcher —
until *Project settings → Analyze / run* takes that over.

The remaining analysis and settings screens are next — see
[`BACKLOG.md`](../../BACKLOG.md) and the *web-ui* issues.

Where each screen's data comes from:

| View | Source in the report |
|------|----------------------|
| Hotspot treemap | `metrics.find((m) => m.id === 'hotspots')` |
| Change coupling | `metrics.find((m) => m.id === 'change-coupling')` |
| Dependency graph | `languages[*].graph` |
| Dead code | `languages[*].deadCode` |
| Commit analytics | `commits[]` (type / scope / breaking) |
| Plugins settings | `GET /plugins` |
