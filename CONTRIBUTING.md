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

Requires **Node 24 LTS** (see `engines`); CI and the Docker image track the
same baseline, and `@types/node` is deliberately pinned to that major rather
than to the newest release.

## Toolchain — two TypeScript versions on purpose

Every package builds with **TypeScript 7** (the native compiler), while the
name `typescript` is deliberately aliased to the TS 6 compatibility package:

```jsonc
// root
"@typescript/native": "npm:typescript@^7.0.2",        // gives you `tsc`  (7.x)
"typescript": "npm:@typescript/typescript6@^6.0.2",   // gives you `tsc6` (6.x)
// packages/* and plugins/* — the build compiler
"typescript": "^7.0.2"
```

This is not an accident, and it follows the [documented side-by-side
layout](https://nx.dev/docs/kb/typescript-7). typescript-eslint does not
support the TS 7 API yet and *hard-errors* on it (`typescript-eslint does not
support TS 7.0`), so anything importing the `typescript` API programmatically
gets 6.x, while the compiler that actually builds the code is 7.x. Sanity-check
a fresh checkout with:

```bash
npx tsc --version    # Version 7.0.2
npx tsc6 --version   # Version 6.0.3
```

Once typescript-eslint ships TS 7 support
([#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940))
both aliases can be dropped and `typescript` unified on 7.

One consequence worth knowing: TS >=6 no longer walks up to an ancestor
`node_modules/@types`, so under pnpm's isolated layout each compiling package
declares its own `@types/node`, and `tsconfig.base.json` sets `"types":
["node"]`. A new package that uses Node globals needs both.

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

### One responsibility per file

A file holds **one** concern: an implementation, its types, a helper, an
alternate implementation and a process entry point each live in their own
module. `index.ts` is a **barrel** — it re-exports the public surface and
contains no logic — so consumers keep importing `@strata/core` or
`./routes/index.js` while the internals stay small and movable.

```
packages/core/src/
  index.ts        barrel: re-exports only
  strata.ts       the orchestrator
  types.ts        report / option types
  logger.ts       console logger
  git/            exec · rev · files · history · churn
  cache/          types · schema · sqlite · null · open · keys · digest · json · stats
```

Tests sit next to what they test (`cache/cache.test.ts`). When a file starts
answering two questions, split it rather than adding a section comment.

`make test` runs two vitest projects from the root config: **node** for
`packages/` and `plugins/`, and **web** for `apps/web`, which needs the Svelte
compiler and a DOM (`apps/web/vitest.config.ts`). Frontend code is tested the
same way as everything else — components mount through `src/lib/test/render`
and are asserted against the DOM.
