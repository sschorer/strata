# Module: `@strata/web` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Status: **in progress** — theme layer, API client and the hotspot and
> dependency-graph screens in place; the workbench shell and the remaining
> analysis screens are still to build.

## 1. Purpose & Goals

The **web UI**: dashboards that turn an `AnalysisReport` into hotspot treemaps,
dependency graphs, commit analytics and dead-code tables, plus the project- and
app-scoped settings screens. The face of Strata for browser/self-host use.

## 2. Constraints

- Talks to `@strata/server` over REST only — no import of `@strata/core`.
  `@strata/sdk` is used for **types only** (`import type`), so nothing of it is
  bundled and the contract stays single-sourced.
- Must render in a browser and, later, inside the Tauri desktop shell → the
  build is static files, with no Node runtime of its own.
- Theme-aware (dark + light), responsive.
- Analysis stays offline: fonts are self-hosted, no CDN or third-party origin.

## 3. Interfaces (Context)

- **Depends on:** the `@strata/server` REST API (`/health`, `/plugins`,
  `/analyze`, `/cache`).
- **Consumed by:** end users (browser / desktop).

## 4. Building Blocks

| Block | Responsibility |
|-------|----------------|
| `src/app.html` | Document shell; applies the stored theme before first paint |
| `src/app.css` | Tailwind entry: fonts, `@theme inline` token mapping, base layer |
| `src/lib/theme/tokens.css` | The palette, twice — dark and light, keyed on `data-theme` |
| `src/lib/theme/*` | `mode` (types + resolution), `storage`, `apply`, `controller.svelte` (state) |
| `src/lib/api/*` | `base` (origin), `request` (fetch + `ApiError`), one module per endpoint, `types` |
| `src/lib/analysis/*` | The app-wide last report (`store.svelte`), the remembered repo path, and `RunForm` |
| `src/lib/format/*` | `number` (compact counts) and `path` (repo path → dir + name), used by every screen |
| `src/lib/geometry/*` | `squarify` — the squarified treemap layout |
| `src/lib/hotspots/*` | The hotspot feature end to end: `rows` (report → rows), `heat` (ramp), and the three views |
| `src/lib/graph/*` | The dependency feature end to end: `merge` (report → one graph), `tree`/`rows` (the folder tree), `collapse` (closed folders), `rank` + `lanes` + `layered` (the columned layout), `edges`, `degree`, `summary`, `cycles`, `focus`, `viewport` (pan/zoom), and the five views |
| `src/lib/components/*` | Reusable UI pieces |
| `src/routes/*` | SvelteKit routes; `+layout.ts` pins the app to SPA mode |
| `src/lib/test/*` | Test helpers: `render` mounts a component, `graph` builds a graph from an edge list |

A screen is a **feature folder**: its pure functions and the components that
render them sit together (`lib/hotspots/`), because they change together. Only
what more than one screen uses moves up into `lib/components/`.

## 5. Runtime

1. `app.html` reads `strata:theme` from `localStorage` and sets `data-theme`.
2. The root layout starts the theme controller, which adopts the stored mode
   and tracks `prefers-color-scheme` while the app is open.
3. A view calls `lib/api`; failures arrive as one `ApiError` shape.
4. In dev, Vite proxies the API paths to `:4000`; in production the server
   serves this build, so the same relative URLs hold.

## 6. Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | **Vite + SvelteKit + Tailwind v4** | Small runtime, first-class Vite, and Tailwind v4's CSS-first `@theme` matches a token file better than a JS config |
| 2 | **`adapter-static`, SPA (`ssr = false`)** | The output is a folder of files: `@strata/server` can serve it from the Docker image and Tauri can load it from disk. Analysis is a local API call — nothing needs server rendering |
| 3 | **Tokens in CSS, mapped with `@theme inline`** | One palette file per theme; utilities resolve the variable at use time, so switching `data-theme` repaints without a rebuild or a duplicate `dark:` class set |
| 4 | **API paths not prefixed (`/analyze`, not `/api/analyze`)** | Matches the server as it is; dev proxy mirrors the same paths, so dev and production URLs are identical |
| 5 | **Type-only dependency on `@strata/sdk`** | The report's leaf types stay in sync with the backend without a runtime coupling |
| 6 | **Self-hosted IBM Plex via `@fontsource`** | Keeps a self-hosted install fully offline |
| 7 | **Squarified treemap written here, no charting library** | ~100 lines of geometry against a dependency that would ship a whole renderer; keeping it in-repo also keeps the layout pure and unit-tested, and the tiles are plain DOM so theming, focus and `aria-pressed` come for free |
| 8 | **Heat by quantile, not by value** | Complexity is long-tailed: equal value steps paint nearly everything cold. Equal population steps keep all five ramp colours on screen, and the legend labels the ranges so nothing is hidden |
| 9 | **Report held in one app-wide store** | An analysis is expensive; the overview, graph and commit screens read the same run rather than each triggering their own |
| 10 | **Layout written here, not Cytoscape/d3** | Decision 7 again, one screen on: a layered layout against a library that ships its own renderer. Keeping it in-repo keeps it a **pure** function — same graph, same coordinates, testable — and keeps the drawing plain SVG, so palette tokens, `:focus-visible` and `aria-pressed` work like everywhere else |
| 11 | **Uniform cards on a grid, in the shape of Nx's project graph** | Two earlier attempts sized a node by what it held. Both failed the same way: a folder of forty files inside a fixed canvas is drawn four pixels wide, and no separation pass can rescue shapes with nowhere to go. A card is one size, so a name is always legible and the grid makes overlap *impossible* rather than merely unlikely. The drawing grows to whatever it needs and the viewport reaches the rest |
| 12 | **Ranks are the dependency direction, running down** | `rank.ts` layers the graph so what a card imports sits below it and every arrow points one way. Cycles have no such order, so the edges closing them are set aside for ranking and drawn pointing back — which is what a knot should look like on a graph that otherwise flows |
| 13 | **The layout is recursive: a folder is laid out, then placed as one box** | An open folder ranks *its own* contents against each other, with the imports between them lifted to that level, and the result takes part in its parent's layout as a single box. That is what keeps a container in one piece: it occupies one place in the flow instead of stretching across every rank of the whole graph, and a folder opened inside another sits inside it. Cards stay one size however deep the tree goes — nesting *sized* boxes would divide the space until the contents vanished |
| 14 | **A crowded rank wraps** | Everything nothing depends on — config files, entry points — lands in the first rank. Left alone that is one line running off the side of the drawing; wrapped past a few, it is a block, and the picture stays a shape |
| 15 | **Folders open and close, and closing aggregates** | `collapse.ts` folds a closed folder into one node and rewrites the imports behind it onto it, merged and counted. So the arrows follow what is on screen: an open folder shows its files' arrows, a closed one shows the single arrow standing for all of them. A repository too big to read opens with its top level only |
| 16 | **Pan and zoom move a `viewBox`, never the layout** | Re-running the layout at each zoom step would rearrange the picture under the reader. `viewport.ts` holds the window as plain values, so the clamping — never out past the whole graph, never off its edge — is one tested thing rather than arithmetic in event handlers |
| 17 | **The canvas fills the room the page gives it** | The window takes the *canvas's* shape, not the drawing's, and a drawing that does not match is letterboxed and centred. Sizing the element to the drawing instead would leave a tall graph as a thin ribbon and a short one as a sliver, wasting the space either way. Resizing the page carries the window across rather than resetting it |
| 18 | **Cycles ordered into a path in the UI** | Tarjan emits a component, not a route through it, and `a → b → a` is what a reader can act on. `cycles.ts` walks the component over real edges until the language result carries the path itself |

## 7. Quality & Risks

- **Risk:** the ordering pass is a barycentre heuristic, so it reduces edge
  crossings without minimising them. A dense graph still braids; routing edges
  around cards, rather than straight between them, is the next step if it bites.
- **Debt:** cards are ranked but not yet *balanced* — a column with one card
  sits at the top of its lane rather than centred against its neighbours.
- **Risk:** the palette here is derived from the mockup's description rather
  than exported from it; expect a tuning pass when the screens land. The light
  heat ramp already took one, so a single light ink clears 4.5:1 on every step.
- **Debt:** the hotspot screen types the repo path into a form and remembers it
  in `localStorage`. That is the project switcher's job — this goes away with it.
- **Debt:** a treemap draws the top ~50 files; the rest of the ranking is only
  in the table. A zoom or a directory roll-up is the fix if it starts to bite.
- **Debt:** the graph summary (nodes, edges, cycles, fan-in) is computed in the
  browser from `languages[*].graph`. The backlog puts it in the language result;
  when it lands, `summary.ts` fills its shape from the report and the view does
  not change.
- **Debt:** package edges are styled but never drawn — by choice, the
  TypeScript module reports only imports that land in the repository. The
  legend shows a style only when the drawing contains it, and `merge.ts`
  synthesises the node the day a plugin does emit one.
- **Debt:** ESLint skips this app (`apps/web/**` is ignored at the root) —
  `svelte-check` is the only static gate until `eslint-plugin-svelte` is wired in.
- **Tests:** `vitest` with the plain Svelte plugin and a `happy-dom`
  environment (`vitest.config.ts`), wired into the root run as a second
  project. Covered: theme resolution, storage, the appearance controller, the
  request helper's error normalisation, the stateful components (`ThemeSwitch`,
  `ServerStatus`), the shared formatters, the hotspot pure layer (rows join,
  heat scale, squarify's area/overlap/aspect invariants) and its three views,
  the graph pure layer (merge and package synthesis, the folder tree and its
  compression, collapsing and its edge merging, the ranking's direction and its
  cycle-breaking, the layered layout's uniform cards, non-overlap of cards *and*
  containers, growth and purity, the panel rows, degrees and ranking, the
  summary, cycle paths over real edges, the focus ranking, edge classification,
  and the viewport's zoom, clamping, letterboxing and carrying across a resize) with its canvas, folder tree and
  cycle list, the analysis store (including a superseded run), plus the
  `/hotspots` and `/graph` routes end to end. Components mount through
  `lib/test/render`; graphs come from `lib/test/graph`.
