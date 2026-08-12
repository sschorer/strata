# Contributing to Strata

Thanks for helping! A few conventions keep the repo tidy and the releases
automatic.

## Setup

```bash
corepack enable
pnpm install
pnpm build && pnpm test
```

## Commits — Conventional Commits

Commit messages must follow [Conventional Commits](https://www.conventionalcommits.org/)
(`commitlint` enforces this via a git hook). Examples:

```
feat(core): add incremental cache
fix(plugin-typescript): resolve index.ts barrels
docs: explain the vouch flow
```

The release tooling (`release-please`) reads these to bump the version and
write the changelog, so the type/scope you pick matters.

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
