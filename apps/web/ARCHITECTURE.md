# Module: `@strata/web` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Status: **scaffolded** — theme layer and API client in place; the workbench
> shell and the analysis screens are still to build.

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
| `src/lib/components/*` | Reusable UI pieces |
| `src/routes/*` | SvelteKit routes; `+layout.ts` pins the app to SPA mode |
| `src/lib/test/render.ts` | Mounts a component into a detached container for a test |

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

## 7. Quality & Risks

- **Risk:** graph rendering perf on large repos. **Mitigation:** virtualise /
  cluster nodes; render server-computed summaries first.
- **Risk:** the palette here is derived from the mockup's description rather
  than exported from it; expect a tuning pass when the screens land.
- **Debt:** ESLint skips this app (`apps/web/**` is ignored at the root) —
  `svelte-check` is the only static gate until `eslint-plugin-svelte` is wired in.
- **Tests:** `vitest` with the plain Svelte plugin and a `happy-dom`
  environment (`vitest.config.ts`), wired into the root run as a second
  project. Covered: theme resolution, storage, the appearance controller, the
  request helper's error normalisation, and the two stateful components
  (`ThemeSwitch`, `ServerStatus`). Components mount through `lib/test/render`.
