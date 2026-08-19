# Strata

> A modular git & code-analysis workbench. Point it at any repo to see
> **hotspots**, **commit analytics**, per-language **dependency graphs** and
> **dead code**, with **pluggable AI providers** — run it locally or self-host
> it over the browser.

Strata is a small core plus four kinds of plugins. Everything — a new language,
a new commit convention, a new git metric, a new AI backend — is a plugin, so
the tool grows without the core changing.

## Status

🚧 **Early scaffold.** The plugin contracts (`@strata/sdk`), the orchestrator
(`@strata/core`), the API (`@strata/server`) and five example plugins are in
place and build. The web UI (`apps/web`) is scaffolded — SvelteKit + Tailwind,
theme layer and API client wired; the analysis screens are next. See
[`BACKLOG`](#roadmap).

## Features (built + planned)

**Git / history intelligence**
- Hotspots — change frequency × complexity ✅ (starter metric)
- Change coupling — files that change together ✅
- Knowledge map / bus factor ⏳
- Commit-convention analytics — Conventional Commits ✅, gitmoji/custom via plugin ⏳

**Per-language analysis** (one plugin per language)
- Dependency graph + import-cycle detection ✅ (TS/JS, parsed with tree-sitter,
  resolving `tsconfig.json` path aliases and dynamic imports)
- Graph summary — nodes, edges, cycles and the busiest module in each
  direction, counted with the graph ✅
- Dead code — unreferenced exports, unreachable files, unused dependencies ✅ (TS/JS)
- Metrics: LOC, cyclomatic complexity, nesting, duplication ✅ (TS/JS)
- Angular module: component/DI graph, lazy boundaries ⏳
- PHP module ⏳

**Core**
- Incremental cache — SQLite, keyed on the git blob sha, so a rerun only
  re-analyses what changed ✅
- Drop-in third-party plugins from a user plugins directory ✅
- Path allow-list + a bearer token on the API — what a request may reach, and
  who may send one ✅

**Architecture & AI**
- Architecture fitness rules ("`ui` may not import `db`") ⏳
- AI: explain a hotspot, NL query over the repo, auto architecture docs ⏳
- CI mode: headless run, JSON/Markdown report, fail on thresholds ⏳

## Quick start (dev)

Everything a dev does is a `make` target (`make help` lists them):

```bash
corepack enable
make install        # pnpm install
make check          # build + typecheck + lint + test (the full local gate)
make dev            # start @strata/server on :4000
make web            # start the web UI on :5173 (proxies the API to :4000)

# analyse any repo straight from the CLI (no server needed)
make analyze REPO=/absolute/path/to/a/repo LIMIT=500

# scaffold a new plugin
make new-plugin NAME=python KIND=language
```

Or hit the API directly:

```bash
curl -X POST localhost:4000/analyze \
  -H 'content-type: application/json' \
  -d '{"root":"/absolute/path/to/a/repo","historyLimit":500}'

# analyses are cached per git blob; force a cold run, or empty the cache
curl -X POST localhost:4000/analyze -H 'content-type: application/json' \
  -d '{"root":"/absolute/path/to/a/repo","cache":false}'
curl -X DELETE localhost:4000/cache
```

Analyses run on a worker thread behind a queue, so the API keeps answering while
one is in flight. `/analyze` waits for the report by default; ask it not to and
you get a job you can follow instead — which is what the workbench does, and why
*Re-analyze* shows what the pipeline is doing rather than freezing:

```bash
# take the job instead of the report
JOB=$(curl -s -X POST localhost:4000/analyze -H 'content-type: application/json' \
  -d '{"root":"/absolute/path/to/a/repo","wait":false}' | jq -r .job.id)

# follow it: one event per step, the last one carrying the report
curl -N localhost:4000/jobs/$JOB/events

curl -s localhost:4000/jobs          # what the queue remembers, newest first
curl -s localhost:4000/jobs/$JOB     # one job, with its report once it has one
```

```bash
# what loaded, from where, and anything that was skipped
curl -s localhost:4000/plugins
```

Every path a request names — the folder picker's, a project's root, `/analyze`'s
`root` — is confined to `$STRATA_ROOTS` (`PATH`-separated, the server user's
home by default, `/repos` in the image). Anything outside is a 403, symlinks
included: what the workbench may walk is a deployment decision rather than
whatever the process can read. Point it at the directory your repositories live
in — or at `/` to opt out of the confinement.

### Who may call

Set `$STRATA_TOKEN` and every endpoint but `/health` needs it:

```bash
STRATA_TOKEN=$(openssl rand -hex 32) make dev

curl -s localhost:4000/plugins                      # 401
curl -s -H "Authorization: Bearer $STRATA_TOKEN" localhost:4000/plugins
```

Leave it unset and the API answers anyone who can reach the port — fine on the
machine you are analysing, which is why it stays the default, and said out loud
at every startup. Set it before the port is reachable from anywhere else, and
put TLS in front: the token travels in the clear otherwise. The web UI asks for
it once and keeps it in the browser.

The two limits are separate — the token says *who* may call, `$STRATA_ROOTS`
says *what* any caller may reach — and holding the token widens nothing.

Repositories can be registered, so the workbench remembers them (and what the
last analysis of each one found) instead of being handed a path every time:

```bash
curl -X POST localhost:4000/projects -H 'content-type: application/json' \
  -d '{"name":"Strata","root":"/absolute/path/to/a/repo"}'
curl -s localhost:4000/projects
# forget a project — the repository on disk is untouched
curl -X DELETE localhost:4000/projects/strata
```

Each project carries its own settings — revision, history window, ignore globs
and analyze paths, which plugins run, the commit convention, architecture
rules. `PATCH` merges, so send only what changed:

```bash
curl -s localhost:4000/projects/strata/config
curl -X PATCH localhost:4000/projects/strata/config \
  -H 'content-type: application/json' \
  -d '{"rev":"main","historyLimit":500,"ignore":["**/dist/**"]}'
```

An analysis of a registered root runs what *Project settings* says: the scope,
the enabled plugins and the commit convention come from the project, and
`rev` / `historyLimit` are defaults a request naming them itself overrides.
(Architecture rules are stored and served; enforcing them is on the backlog.)

The registry lives in `$STRATA_DATA_DIR` (default `<cwd>/.strata/projects.db`),
its own database beside the cache: `DELETE /cache` never touches it.

One scope up are the app-wide settings — appearance, the plugin and cache
engine, the CI gate thresholds and the AI providers this workbench knows about.
`PATCH` merges by section and by field, so a settings screen sends back only
what it edits:

```bash
curl -s localhost:4000/settings
curl -X PATCH localhost:4000/settings -H 'content-type: application/json' \
  -d '{"appearance":{"theme":"light"},"gates":{"failOnNewCycles":true}}'
# point the workbench at another plugins directory, or stop loading drop-ins
curl -X PATCH localhost:4000/settings -H 'content-type: application/json' \
  -d '{"engine":{"pluginsDir":"/opt/strata/plugins","thirdPartyPlugins":false}}'
```

The cache toggle applies to the next run; the two plugin settings are read when
the server starts, because that is when plugins load. Appearance, the gates and
the AI providers are stored and served for the screens and the headless CI mode
still being built — see [`BACKLOG.md`](BACKLOG.md). Provider environment values
are held as written, so nothing secret belongs in them until secret storage
lands. The settings live beside the registry, in
`$STRATA_DATA_DIR/settings.db`.

Third-party plugins are drop-in: one directory per plugin (with its
`strata.plugin.json`) under `$STRATA_PLUGINS_DIR`, default
`<cwd>/.strata/plugins`. Built-ins load first, a plugin that fails to load is
reported rather than fatal — see [`docs/PLUGINS.md`](docs/PLUGINS.md).

The cache lives in `$STRATA_CACHE_DIR` (default `<cwd>/.strata/cache.db`) —
keep it out of the repo you analyse, which the server and container defaults
already do; `STRATA_CACHE=0` disables it globally.

## Run with Docker

```bash
docker run --rm -p 4000:4000 \
  -v /path/to/repo:/repos/target:ro \
  -e STRATA_TOKEN="$(openssl rand -hex 32)" \
  ghcr.io/sschorer/strata:latest
# then POST /analyze with {"root":"/repos/target"} and the token as
# `Authorization: Bearer <token>`
# the image confines requests to /repos ($STRATA_ROOTS); mount elsewhere and
# set it to match
```

Published ports are reachable from more than the host — set the token, or
publish to `127.0.0.1:4000:4000` only.

Or `docker compose up` (see `compose.yml`).

## Repository layout

```
packages/
  sdk/      @strata/sdk    plugin contracts (the public API)
  core/     @strata/core   orchestrator + git ingest + plugin registry
  server/   @strata/server Fastify HTTP API
plugins/
  commit-conventional/     Conventional Commits parser
  git-hotspots/            churn × complexity metric
  language-typescript/     TS/JS import graph, cycles + code metrics
  ai-provider-template/    copy-me AI backend
apps/
  web/      @strata/web    web UI — SvelteKit SPA + Tailwind (scaffold)
docs/                      architecture, plugin authoring, ops
```

## Docs

- [Architecture (arc42)](docs/ARCHITECTURE.md) — full project structure & decisions
- [Backlog](BACKLOG.md) — planned features, prioritised
- [Writing a plugin](docs/PLUGINS.md)
- [Branch protection & governance](docs/BRANCH_PROTECTION.md)
- [The vouch system](docs/VOUCH.md)
- [Contributing](CONTRIBUTING.md)

Every module also carries its own `ARCHITECTURE.md` (same arc42 format) — see
`packages/*/ARCHITECTURE.md` and `plugins/*/ARCHITECTURE.md`.

## Roadmap

See [BACKLOG.md](BACKLOG.md). Contributions welcome — but note the repo uses a
**vouch** model: non-owner PRs merge once a vouched reviewer approves. See
[docs/VOUCH.md](docs/VOUCH.md).

## License

Apache-2.0 © Stephan Schorer
