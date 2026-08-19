# Module: `@strata/web` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Status: **in progress** — theme layer, API client, the workbench shell, the
> project switcher, the overview, hotspot and dependency-graph screens, the
> settings shell and its *Project settings → General* and *Analyze / run*
> sections in place; the commit and dead-code screens, and the remaining
> settings sections, are still to build.

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
  `/analyze`, `/jobs`, `/jobs/:id`, `/jobs/:id/events`, `/cache`, `/projects`,
  `/projects/:id/config`, `/browse`, `/settings`).
- **Authentication:** none of its own. A deployment that set `$STRATA_TOKEN`
  answers 401 until the reader supplies it once; it is then sent as
  `Authorization: Bearer <token>` on every call.
- **Consumed by:** end users (browser / desktop).

## 4. Building Blocks

| Block | Responsibility |
|-------|----------------|
| `src/app.html` | Document shell; applies the stored theme before first paint |
| `src/app.css` | Tailwind entry: fonts, `@theme inline` token mapping, base layer |
| `src/lib/theme/tokens.css` | The palette, twice — dark and light, keyed on `data-theme` |
| `src/lib/theme/*` | `mode` (types + resolution), `storage`, `apply`, `controller.svelte` (state) |
| `src/lib/api/*` | `base` (origin), `request` (`apiFetch`/`apiRequest` — fetch + the bearer header + `ApiError`), `events` (the job stream, parsed off a `fetch` body), one module per endpoint, `types` |
| `src/lib/auth/*` | The workbench token: `storage` (where the browser keeps it), `session.svelte` (what is held, and whether the server has locked us out), `verify` (does the server answer to this one), and `Unlock` — the panel that takes it |
| `src/lib/analysis/*` | The app-wide run: `store.svelte` (the last report, and where a running analysis has got to), `follow` (stream a job to its end, ask if the stream drops), `label` (progress → one line and a fraction), `RunProgress` (that, drawn), and the remembered repo path |
| `src/lib/projects/*` | The project registry end to end: `store.svelte` (the registered projects and which one the workbench is on), `entries` (project → a switcher row), `label` (root → name), `crumbs` (path → the picker's steps), `selection` (the remembered choice), and the views — `ProjectSwitcher`, `ProjectList`, `AddProject`, `FolderPicker` |
| `src/lib/plugins/*` | What the workbench loaded (`store.svelte`), fetched once for the whole app |
| `src/lib/shell/*` | The frame: `nav` (the map of the workbench), `summary` (report → the header's chips), and the views — `Shell`, `Rail`, `Header`, `NavList`, `RunSummary`, `PluginCount`, `Logo` |
| `src/lib/settings/*` | The settings area's frame: `scope` (path → project or app), `sections` (what each scope holds), `heading` (scope + project → what the area calls itself), `config.svelte` (the open project's config, held for every project section), and the views — `SettingsNav` (the rail in settings mode), `SettingsScreen` and `SectionList` (a scope's landing screen). Then the sections: `general` (the *General* form → the two patches a save sends) with `GeneralScreen`, and *Analyze / run* — `run-window` (project + config → what the next run reads), `run-plugins` (the loaded plugins → who takes part, and why the rest stand by), `recents` (the log's rules), `recents-storage` (where it is kept) and `recent-rows` (the log → strings) with `AnalyzeScreen`, `RunPlugins` and `RecentRuns` |
| `src/lib/format/*` | `number` (compact counts), `path` (repo path → dir + name), `duration` and `age`, used by every screen |
| `src/lib/geometry/*` | `squarify` — the squarified treemap layout |
| `src/lib/overview/*` | The overview feature end to end: `stats` (report + plugins → the six cards), `bars` (the hotspot head, as shares of the top file), `commits` (history → change types and totals), `dead-code` (findings, and the files holding them), and the six views |
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
4. A view calls `lib/api`; failures arrive as one `ApiError` shape. Every call
   carries the workbench token when the browser holds one, and a 401 locks the
   session, which puts the unlock panel in place of the whole frame until a
   token is accepted.
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
| 25 | **A first analysis is started where a run is configured** | A project that has just been registered has nothing to show on any screen, so the switcher says so — and links to *Project settings → Analyze / run*, which owns the run. It carried the run itself while that screen did not exist; keeping both would be two doors to one thing, and the one in a dropdown could not show what the run is about to read |
| 26 | **The overview folds nothing of its own that another screen already folds** | Its cards read `hotspotRows`, `reportSummary` and `cycleViews` — the same functions the hotspot and dependency screens read. An overview is a second opinion about one run, and a second implementation of "how many cycles" would eventually be a *different* opinion. What is new here is only what no other screen needed: the six cards, the bar shares, the change types and the dead-code count |
| 27 | **Change types are a bar list, not a coloured strip** | The mockup's commit strip wants six hues; the palette has none to give. `h1…h5` is a *sequential* ramp — validated as a categorical set it fails on adjacent pairs no reader can separate, colour-blind or not — and the status colours are reserved for status. Painting `docs` and `test` from a heat ramp would also say "hotter = worse" about neither. So identity is the label and magnitude is the bar, which is what the two facts are; breaking changes are marked with the danger token *and* the word, as a status should be |
| 28 | **Settings is a place, so the rail swaps rather than grows** | A settings area with seven project sections and five app ones cannot hang off a nav entry, and hanging it under the analysis screens would make the rail a list of everything Strata can do. `settingsScope(pathname)` is the whole mechanism: inside `/settings/*` the rail — and the narrow-screen strip, for the same reason — shows *Back to workbench*, the scope's heading and its sections, and nothing else. The route decides, so a link into a section arrives with the right frame already up |
| 29 | **The scoped heading replaces the switcher, it does not sit beside it** | Project settings belong to the project the workbench is on; leaving the switcher up would let a reader change *which* project while looking at its settings, and two ways to say which one is being configured eventually disagree. The heading names the project and prints its root, so the scope is visible without being changeable — and app settings say *This workbench* in the same slot, because that is what they reach |
| 30 | **Each scope has a landing screen listing its own sections** | The rail lists section names; a name like *Scope & ignore* only means something with a line beside it. The landing screen is that line, and it is also what a scope's route can honestly show while every section is still on the backlog. `SettingsScreen` renders both scopes — the scope is the only thing that differs, and a second copy would be a second answer to "what can be configured here" |
| 31 | **The root is shown, not edited** | `PATCH /projects/:id` can re-point a project, and *General* still prints the root as a read-only mount. A root is what makes a project *that* repository: moving it under the same entry would keep the name, the settings and the last run's summary while every one of them now describes something else. Removing and adding again says that plainly, costs a registry row, and touches nothing on disk. What the field is for is the opposite problem — an absolute server-side path is the one thing a reader of a web UI cannot see (decision 24), so it is worth printing where it can be read and copied |
| 32 | **One config store behind every project section** | The revision *General* edits is the revision *Analyze / run* shows and the one *Scope & ignore* sits beside; `config.svelte` holds it once, keyed on the project it belongs to, so the sections are screens over one document rather than seven copies drifting apart. Keyed, because the workbench can be pointed at another project while a section is open — a revision read under one project must never be saved under another. It holds what the server answers rather than what was sent, since the server normalises on the way in |
| 33 | **A section saves the two documents behind it as one screen** | *General* edits the display name, which is the registry entry, and the revision and history limit, which are the project's config — two endpoints, because the root has to stay unique across projects and the config is not the place that can promise that. `general.ts` turns the form into whichever halves changed, so an untouched half is not sent, and identity goes first: a config write that fails then leaves a screen whose own heading is still right |
| 34 | **The run window is printed where a run is started, edited where it is owned** | *Analyze / run* shows the root, revision and history limit and offers no field for any of them: they are one setting each and *General* is where a setting is set. A second form over the same two values would be a second answer to "what does this project analyse", and the one in front of the button would win by being nearer. What the screen owes the reader is what is about to happen, so it prints the three and links to the screen that changes them |
| 35 | **The chips say what the orchestrator does, not what the config allows** | `runPlugins` follows the pipeline's own rule — every language module and git metric runs, the first commit-convention plugin parses and the rest stand by, an AI provider takes no part — because a chip in front of *Run analysis* is a promise about the next run. The per-project plugin lists are stored and not yet honoured (`BACKLOG.md` → *Honour the rest of a project's config*), so filtering the chips by them would show a plugin as skipped that in fact runs. A plugin that stands by prints why: "why is my convention plugin doing nothing" is the question this screen exists to answer |
| 36 | **The recents list is this browser's log, seeded from the registry** | The server records one run per project — the last one — so a list of several has nowhere else to live yet (`BACKLOG.md` → *Run history per project*). `recents-storage` keeps it per project in `localStorage`, and the registry's last run is folded in when the screen opens, so a run from another machine still shows up as the newest entry. `mergeRun` dedupes on the finish timestamp and hands back the **same list** when nothing is new, which is what keeps the effect that records a finished run from watching its own write. The screen also folds that run into the registry itself: the switcher normally does it and is not mounted inside settings |
| 37 | **A 401 locks the whole app, not the call that got it** | A server started with `$STRATA_TOKEN` refuses *everything*, so a screen that renders "401" per panel would say it five times and explain it nowhere. `request.ts` hands the status to the session, the session locks, and the root layout puts `Unlock` where the frame goes — one prompt, one place, and no store left showing a stale count it can no longer refresh. Unlocking reloads rather than replaying: every store loads once and is holding a failed request by then, and a reload is the honest way to start them over |
| 38 | **The token is checked before it is adopted, and dropped when it is refused** | `Unlock` calls `/plugins` with the candidate — `apiRequest`'s `token` option, which also promises not to re-raise the prompt — so a typo is answered where it was typed rather than by every screen behind it failing again. A token the server turns down is cleared from `localStorage` on the way into the lock, because keeping it only means the next reload fails the same way with nothing on screen to say why |
| 39 | **A run is a job that is followed, never a request that is waited on** | `POST /analyze` is sent with `wait: false`, so the workbench holds an id within milliseconds and `GET /jobs/:id/events` tells it what the pipeline is doing while it does it. Waiting on the request would mean a fetch left open for minutes, a button that has visibly stopped responding, and nothing to say when it eventually came back — and a reload mid-run would have thrown the run away. The store still guards *which* run it adopts: pointing the workbench elsewhere mid-run must not drop one project's report onto another project's screen, while the run itself carries on and still updates that project's summary |
| 40 | **The stream is read over `fetch`, not `EventSource`** | The API is behind a bearer token and `EventSource` cannot send a header. Parsing the frames off a `fetch` body is a few lines (`api/events.ts`) and keeps every call to the server going through the one place that knows about the token and about a 401 — an `EventSource` would have needed the credential in the query string, which is exactly where a token must not go |
| 41 | **A dropped stream is not a failed run** | A connection held open for the length of an analysis gets dropped: by a proxy with an idle timeout, a laptop that slept, a network that blinked. `followJob` falls back to asking `GET /jobs/:id` — the same question, more slowly — because the job outlives its stream, and saying *Analysing…* over a run that finished ten minutes ago would be worse than either |
| 42 | **Progress is a stage and a count, not an invented percentage** | The server reports the pipeline's own steps and admits it does not know the total until the file list makes it knowable. `RunProgress` draws a bar only once there is one to draw and sweeps until then, so it never jumps backwards when the plan firms up. While a run is on it takes the slot the last run's summary had: those numbers describe the report on screen, and the one being replaced is the less interesting of the two |

## 7. Quality & Risks

- **Risk:** the ordering pass is a barycentre heuristic, so it reduces edge
  crossings without minimising them. A dense graph still braids; routing edges
  around cards, rather than straight between them, is the next step if it bites.
- **Debt:** cards are ranked but not yet *balanced* — a column with one card
  sits at the top of its lane rather than centred against its neighbours.
- **Risk:** the palette here is derived from the mockup's description rather
  than exported from it; expect a tuning pass when the screens land. The light
  heat ramp already took one, so a single light ink clears 4.5:1 on every step.
- **Debt:** *Add project* lands on the new project but not on *Project settings
  → Analyze / run*; the switcher links there instead (decision 25), so the
  first analysis costs one click more than it could. Navigating from the
  switcher would put routing inside a component the frame otherwise keeps clear
  of it (decision 20), which is not worth that click yet.
- **Risk:** the workbench token is kept in `localStorage`, so any script that
  runs on this origin can read it. Nothing third-party is loaded — no CDN, no
  analytics, fonts are self-hosted — which is what makes it acceptable; a
  session cookie the browser cannot read is the upgrade if the UI ever grows
  a surface that renders untrusted HTML.
- **Debt:** the recents list is per browser (decision 36), so a workbench used
  from two machines shows two different lists over the same project — each with
  the server's last run at the top. A handful of runs kept in the registry is
  the fix, and is on the backlog.
- **Debt:** every settings section but *Project settings → General* and
  *Analyze / run* is still
  listed and inert, so `/settings/app` is a landing screen only. Each section
  is its own issue, and the day one lands it becomes `ready` in `sections.ts`
  and the rail links to it — nothing else in the shell has to change.
- **Decision:** re-pointing a project at another path is deliberately not
  offered (decision 31), so the `root` half of `PATCH /projects/:id` is wired
  through `lib/api` and the registry store but nothing in the UI sends it. It
  stays because the store has to re-point the analysis if it ever does.
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
- **Risk:** the overview's dead-code card counts the findings the language
  modules report, and those are still approximate — entry points and
  resolution are exact only once tree-sitter lands. The card prints findings
  *and* the files holding them, so a barrel of unused exports does not read as
  twenty separate problems; the *preview* framing belongs on the dead-code
  screen, where the findings themselves are listed.
- **Debt:** `TokenPalette` and `ServerStatus` are now unmounted: the real
  overview replaced the workbench's own state, and `/health` has no screen
  until *App settings*. Both keep their place in `lib/components` for it.
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
  a reload, add, rename, re-point, remove and the fold of a finished run) with
  the switcher end
  to end, the settings shell (the scope a path is in, each scope's sections,
  which of them are built and
  that every one of them stays inside its scope, the scoped heading with and
  without a project, the rail in settings mode — both orientations — and the
  two landing routes), the project config store (load-once per project, the
  supersede when the workbench moves, and that a save holds the server's
  answer and a refused one changes nothing), the *General* form's pure layer
  (the stored values in, only the halves and fields that changed out, a blank
  limit as the whole history, and each rule it refuses) with the screen end to
  end — the values it opens on, the root as a read-only mount, nothing to save
  until an edit, a rename through the registry, the window through the config,
  a bad limit answered without a round-trip, a refusal from the server, discard,
  no project, and a config that could not be read — and its
  route, *Analyze / run*'s pure layer (the window a run reads, who takes part
  and why the rest stand by, the log's ordering, its cap, its identity-on-
  duplicate and the shape it is stored in) with its two views and the screen
  end to end — the window it opens on, the chips, the run it posts and folds
  into the registry, the log it opens on and remembers, a refused run, no
  project, and a config that could not be read — and its route,
  the plugin store's load-once, the overview's pure layer (the six
  cards' order, values, tones and links, a clean report reading as *none*, bar
  shares held against the whole ranking, change types grouped and tied by name,
  and dead code counted per finding *and* per file) with its views — the stat
  grid through its cards, the hotspot bars, the change types, the cycle alert
  and the plugin list — plus
  the `/`, `/hotspots` and `/graph`
  routes end to end, and the folder picker (listing, walking in and back out,
  the path bar, picking a repository or the current folder, the hidden toggle,
  a refusal from the server, and a server that browses nothing) including the
  path it hands *Add project*. Components mount through `lib/test/render`;
  graphs come from `lib/test/graph`; an API of more than one endpoint from
  `lib/test/api`.
