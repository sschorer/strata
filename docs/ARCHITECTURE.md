# Architecture

Strata is a small orchestrator surrounded by four plugin kinds. The core never
needs to change to support a new language, commit convention, metric, or AI
backend — you add a plugin.

```
                 ┌──────────────────────────┐
                 │   @strata/core           │
                 │   RepoContext · registry │
                 │   git ingest · cache     │
                 └───────────┬──────────────┘
        ┌────────────┬───────┴────────┬──────────────┐
        ▼            ▼                ▼               ▼
   Language      Commit-convention  Git-metric    AI-provider
   plugins       plugins            plugins       plugins
```

## Flow

1. **Ingest** — `core/git.ts` resolves a revision, lists tracked files (each
   with its blob sha, for incremental caching), and streams structured commit
   history.
2. **RepoContext** — an immutable view (`root`, `rev`, `files`, `git()`, `log`)
   handed to every plugin. Plugins never reach outside it.
3. **Fan-out** — the orchestrator (`core/index.ts`) routes files to language
   plugins by extension, runs git-metric plugins over history, and parses
   commits with the active commit-convention plugin.
4. **Report** — results are merged into an `AnalysisReport`, served by
   `@strata/server` and (soon) rendered by `apps/web`.

## Why plugins default-export a `define*` helper

`@strata/sdk` exposes `defineLanguagePlugin`, `defineCommitConventionPlugin`,
`defineGitMetricPlugin`, and `defineAIProvider`. They stamp the `kind`
discriminant and give you full type-checking of the object you return. The
registry imports a plugin's `main` module and reads its default export.

## Incremental analysis (design)

Every `RepoFile` carries its git blob sha. The cache (SQLite, planned in
`@strata/core`) keys per-file analysis on `(pluginId, blob)`, so re-analysing a
repo only re-runs plugins on files whose content actually changed. Metric
plugins that need history use the commit range, which is likewise cacheable.

## Performance notes

- Parsing should move to **tree-sitter** grammars per language — one framework,
  many languages, and the same AST shape the analyzers already expect.
- Heavy runs belong on a worker queue (BullMQ / worker_threads) so the API and
  UI stay responsive.
