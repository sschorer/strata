# Module: `@strata/web` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Status: **in progress** — theme layer, API client, the workbench shell, the
> project switcher and the hotspot and dependency-graph screens in place; the
> remaining analysis and settings screens are still to build.

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
  `/analyze`, `/cache`, `/projects`, `/browse`).
- **Consumed by:** end users (browser / desktop).

## 4. Building Blocks

| Block | Responsibility |
|-------|----------------|
| `src/app.html` | Document shell; applies the stored theme before first paint |
| `src/app.css` | Tailwind entry: fonts, `@theme inline` token mapping, base layer |
| `src/lib/theme/tokens.css` | The palette, twice — dark and light, keyed on `data-theme` |
| `src/lib/theme/*` | `mode` (types + resolution), `storage`, `apply`, `controller.svelte` (state) |
| `src/lib/api/*` | `base` (origin), `request` (fetch + `ApiError`), one module per endpoint, `types` |
| `src/lib/analysis/*` | The app-wide last report (`store.svelte`) and the remembered repo path |
| `src/lib/projects/*` | The project registry end to end: `store.svelte` (the registered projects and which one the workbench is on), `entries` (project → a switcher row), `label` (root → name), `crumbs` (path → the picker's steps), `selection` (the remembered choice), and the views — `ProjectSwitcher`, `ProjectList`, `AddProject`, `FolderPicker` |
| `src/lib/plugins/*` | What the workbench loaded (`store.svelte`), fetched once for the whole app |
| `src/lib/shell/*` | The frame: `nav` (the map of the workbench), `summary` (report → the header's chips), and the views — `Shell`, `Rail`, `Header`, `NavList`, `RunSummary`, `PluginCount`, `Logo` |
| `src/lib/format/*` | `number` (compact counts), `path` (repo path → dir + name), `duration` and `age`, used by every screen |
| `src/lib/geometry/*` | `squarify` — the squarified treemap layout |
| `src/lib/hotspots/*` | The hotspot feature end to end: `rows` (report → rows), `heat` (ramp), and the three views |
| `src/lib/graph/*` | The dependency feature end to end: `merge` (report → one graph), `summary` (report → the panel's numbers), `tree`/`rows` (the folder tree), `collapse` (closed folders), `rank` + `lanes` + `layered` (the columned layout), `edges`, `degree`, `cycles`, `focus`, `viewport` (pan/zoom), and the five views |
| `src/lib/components/*` | Reusable UI pieces |
| `src/routes/*` | SvelteKit routes; `+layout.ts` pins the app to SPA mode |
| `src/lib/test/*` | Test helpers: `render` mounts a component, `graph` builds a graph from an edge list, `api` stubs `fetch` per endpoint |

A screen is a **feature folder**: its pure functions and the components that
render them sit together (`lib/hotspots/`), because they change together. Only
what more than one screen uses moves up into `lib/components/`.

## 5. Runtime

1. `app.html` reads `strata:theme` from `localStorage` and sets `data-theme`.
2. The root layout starts the theme controller, which adopts the stored mode
   and tracks `prefers-color-scheme` while the app is open.
3. The switcher loads the registry and adopts the project the workbench was
   last on, which points `lib/analysis` at that repository.
4. A view calls `lib/api`; failures arrive as one `ApiError` shape.
5. In dev, Vite proxies the API paths to `:4000`; in production the server
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
| 19 | **The window is the frame: only the main pane scrolls** | The rail and the header hold still and the content column scrolls inside them. That is what lets a treemap or a graph canvas size itself against the room it is given — a page that scrolls as a whole gives a canvas a viewport that moves out from under it — and it keeps the branch, revision and *Re-analyze* reachable from the bottom of a long table |
| 20 | **The shell takes the route as a prop** | `+layout.svelte` is the only thing that reads `$app/state`; `Shell` and everything under it is handed a `pathname`. The frame then mounts in a test the same way every other component does, without SvelteKit's runtime, and the nav's active-entry rule stays a pure function (`nav.ts`) |
| 21 | **Screens on the backlog are listed, disabled** | The rail is the map of the workbench. Hiding *Commits*, *Dead code* and the two settings scopes until they exist would make each one appear as a surprise; showing them as `soon` says what Strata is going to be, and an inert entry cannot navigate to a route that is not there |
| 22 | **The switcher points the workbench; the analysis store runs it** | Which project is open is one fact, so one store owns it: `lib/projects` holds the registry and the choice, and hands `lib/analysis` the root. That is also why picking another project drops the report on screen — a report describes the repository that was analysed, and leaving it up would draw one project's graph under another project's name |
| 23 | **The registry replaces the repo-path form** | Every screen used to run its own *Repository path* field, which made the typed path and the registered projects two answers to the same question. The path is now typed once, in *Add project*, and the screens read whatever the switcher is on |
| 24 | **The path is browsed, not only typed** | An absolute server-side path is the one thing a reader of a web UI cannot see, and on a remote or containerised workbench they may never have seen it at all. `FolderPicker` walks `GET /browse` and marks the repositories, so *Add project* is a tree with the answers already highlighted; the field stays beside it, because pasting a path is faster when you know it |
| 25 | **A first analysis can be started from the switcher** | A project that has just been registered has nothing to show on any screen. *Project settings → Analyze / run* is where that run belongs, and the entry moves there when the screen lands; until then the switcher offers it, because the alternative is an empty workbench with no visible way out |

## 7. Quality & Risks

- **Risk:** the ordering pass is a barycentre heuristic, so it reduces edge
  crossings without minimising them. A dense graph still braids; routing edges
  around cards, rather than straight between them, is the next step if it bites.
- **Debt:** cards are ranked but not yet *balanced* — a column with one card
  sits at the top of its lane rather than centred against its neighbours.
- **Risk:** the palette here is derived from the mockup's description rather
  than exported from it; expect a tuning pass when the screens land. The light
  heat ramp already took one, so a single light ink clears 4.5:1 on every step.
- **Debt:** *Add project* should land on *Project settings → Analyze / run* for
  the first analysis; that screen is not built, so the switcher carries the run
  itself (decision 24) and the entry moves the day the screen exists.
- **Debt:** a project can be registered and removed from the switcher but not
  renamed or re-pointed — `PATCH /projects/:id` is wired on the server and
  waits for *Project settings → General*.
- **Debt:** a treemap draws the top ~50 files; the rest of the ranking is only
  in the table. A zoom or a directory roll-up is the fix if it starts to bite.
- **Decision:** the graph summary (nodes, edges, cycles, fan-in) is read, not
  computed: every language result carries its own, counted by the plugin, and
  `summary.ts` only adds them up across languages.
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
  containers, growth and purity, the panel rows, degrees, the
  summary fold across languages, cycle paths over real edges, the focus
  ranking, edge classification,
  and the viewport's zoom, clamping, letterboxing and carrying across a resize) with its canvas, folder tree and
  cycle list, the analysis store (including a superseded run), the shell (the
  nav's active entry and its planned ones, the run summary's fold, the rail,
  the header's breadcrumb and *Re-analyze*, and the frame itself), the project
  registry (its rows, the project label, the store's selection, adoption after
  a reload, add, remove and the fold of a finished run) with the switcher end
  to end, the plugin store's load-once, plus the `/hotspots` and `/graph`
  routes end to end, and the folder picker (listing, walking in and back out,
  the path bar, picking a repository or the current folder, the hidden toggle,
  a refusal from the server, and a server that browses nothing) including the
  path it hands *Add project*. Components mount through `lib/test/render`;
  graphs come from `lib/test/graph`; an API of more than one endpoint from
  `lib/test/api`.
