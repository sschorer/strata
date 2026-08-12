# Contributing to Strata

Thanks for helping! A few conventions keep the repo tidy and the releases
automatic.

## Setup

```bash
corepack enable
make install
make check      # build + typecheck + lint + test
```

`make help` lists every developer action (build, dev, analyze, new-plugin,
docker, release-check, …). Prefer the Makefile over raw pnpm so everyone runs
the same commands.

## Commits — Conventional Commits (required)

Commit messages **must** follow [Conventional Commits](https://www.conventionalcommits.org/).
This is enforced twice: locally by a husky `commit-msg` hook, and on every PR by
the `commitlint` CI check — non-conforming commits cannot merge. Examples:

```
feat(core): add incremental cache
fix(plugin-typescript): resolve index.ts barrels
docs: explain the vouch flow
```

Check your branch before pushing with `make commitlint`. The release tooling
(`release-please`) reads these to bump the version and write the changelog, so
the type/scope you pick matters.

## Architecture docs (arc42)

The project architecture is documented in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
using the [arc42](https://arc42.org/) template. **Every module** (each package
and plugin) has its own `ARCHITECTURE.md` in the same trimmed arc42 format —
when you add or significantly change a module, add/update its doc. New plugins
scaffolded with `make new-plugin` should get one too.

## Pull requests

- Branch from `main`, open a PR, fill in the template.
- CI (`build`) and the `gate` check must pass.
- Your PR merges once an **owner or a vouched reviewer** approves it — see
  [docs/VOUCH.md](docs/VOUCH.md). New contributors: ask an owner to `/vouch`
  a reviewer or to review directly.

## Adding a plugin

See [docs/PLUGINS.md](docs/PLUGINS.md). New languages, commit conventions, git
metrics, and AI providers are all plugins — please add tests and a
`strata.plugin.json`.

## Code style

TypeScript, ESM, strict mode. Keep the `@strata/sdk` contract stable; breaking
it is a major version bump with a migration note.
