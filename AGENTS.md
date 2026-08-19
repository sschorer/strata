# Strata — Agent Guide

A modular git & code-analysis workbench: a small core (`@strata/core`) plus
plugins, contracts in `@strata/sdk`, an HTTP API in `@strata/server`, and a
SvelteKit web app in `apps/web`. Start with `README.md` for what it does and
`docs/ARCHITECTURE.md` for how it's put together; `CONTRIBUTING.md` covers
commits, branches and review.

## Agent skills

### Issue tracker

GitHub issues in `sschorer/strata` (via `gh`), mirrored line-for-line by `BACKLOG.md` — creating or closing an issue means editing both. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name; orthogonal to the mandatory `area:*` and `priority:*` labels. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context — a root `CONTEXT-MAP.md` over one `CONTEXT.md` per workspace package (`packages/*`, `apps/*`, `plugins/*`). See `docs/agents/domain.md`.
