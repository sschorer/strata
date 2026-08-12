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
(`@strata/core`), the API (`@strata/server`) and four example plugins are in
place and build. The web UI and richer analyzers are next — see
[`BACKLOG`](#roadmap).

## Features (built + planned)

**Git / history intelligence**
- Hotspots — change frequency × complexity ✅ (starter metric)
- Change coupling — files that change together ⏳
- Knowledge map / bus factor ⏳
- Commit-convention analytics — Conventional Commits ✅, gitmoji/custom via plugin ⏳

**Per-language analysis** (one plugin per language)
- Dependency graph + import-cycle detection ✅ (TS/JS starter)
- Dead code (unreferenced exports, unreachable files) ⏳
- Metrics: LOC, complexity, duplication ⏳
- Angular module: component/DI graph, lazy boundaries ⏳
- PHP module ⏳

**Architecture & AI**
- Architecture fitness rules ("`ui` may not import `db`") ⏳
- AI: explain a hotspot, NL query over the repo, auto architecture docs ⏳
- CI mode: headless run, JSON/Markdown report, fail on thresholds ⏳

## Quick start (dev)

```bash
corepack enable
pnpm install
pnpm build
pnpm dev            # starts @strata/server on :4000

# analyse a repo
curl -X POST localhost:4000/analyze \
  -H 'content-type: application/json' \
  -d '{"root":"/absolute/path/to/a/repo","historyLimit":500}'
```

## Run with Docker

```bash
docker run --rm -p 4000:4000 \
  -v /path/to/repo:/repos/target:ro \
  ghcr.io/sschorer/strata:latest
# then POST /analyze with {"root":"/repos/target"}
```

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
  language-typescript/     TS/JS import graph + cycles
  ai-provider-template/    copy-me AI backend
apps/
  web/                     web UI (placeholder — scaffold here)
docs/                      architecture, plugin authoring, ops
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Writing a plugin](docs/PLUGINS.md)
- [Branch protection & governance](docs/BRANCH_PROTECTION.md)
- [The vouch system](docs/VOUCH.md)
- [Contributing](CONTRIBUTING.md)

## Roadmap

See open issues. Contributions welcome — but note the repo uses a **vouch**
model: non-owner PRs merge once a vouched reviewer approves. See
[docs/VOUCH.md](docs/VOUCH.md).

## License

MIT © Stephan Schorer
