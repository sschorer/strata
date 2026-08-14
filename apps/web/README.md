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
    components/       reusable UI pieces
    test/             test helpers (component mounting)
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

Scaffold: the theme layer, the typed API client and one page that proves both
are wired. The app shell (left rail, header, project switcher) and the analysis
screens are next — see [`BACKLOG.md`](../../BACKLOG.md) and the *web-ui* issues.

Where each screen's data comes from:

| View | Source in the report |
|------|----------------------|
| Hotspot treemap | `metrics.find((m) => m.id === 'hotspots')` |
| Change coupling | `metrics.find((m) => m.id === 'change-coupling')` |
| Dependency graph | `languages[*].graph` (Cytoscape/d3) |
| Dead code | `languages[*].deadCode` |
| Commit analytics | `commits[]` (type / scope / breaking) |
| Plugins settings | `GET /plugins` |
