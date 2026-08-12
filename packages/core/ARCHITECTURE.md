# Module: `@strata/core` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **orchestrator**. Ingests a git repository, holds the plugin registry, builds
the immutable `RepoContext`, and drives the analysis pipeline that fans work out
to plugins. This is the only module that knows about all four plugin kinds.

## 2. Constraints

- Reads git by shelling out to the `git` binary (must be on PATH).
- Hands plugins nothing but a `RepoContext` — no direct fs/network leakage.
- Pure in → out per file, so results stay cacheable/incremental.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk` (contracts), `git` CLI.
- **Consumed by:** `@strata/server` (and `scripts/analyze.mjs`).
- **Public API:** `Strata.analyze(opts) → AnalysisReport`, `PluginRegistry`,
  `gitUtil` helpers.

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `git.ts` | `resolveRev`, `listFiles` (with blob shas), `history`, `churn`. |
| `registry.ts` | `PluginRegistry` — load manifests, SDK-major check, `byKind()`. |
| `index.ts` | `Strata` orchestrator + `AnalyzeOptions` / `AnalysisReport`. |

## 5. Runtime

`analyze()`:
1. `resolveRev` → sha; `listFiles` → `RepoFile[]` (blob-keyed).
2. Build `RepoContext`.
3. Route files to `language` plugins by extension.
4. Stream `history`; run `git-metric` plugins.
5. Parse commits with the first `commit-convention` plugin.
6. Merge into `AnalysisReport`.

## 6. Decisions

- **Extension-based routing** for language plugins (simple, fast).
- **First-registered commit convention wins** (single active convention).
- **Blob sha on every file** now, so the planned `(pluginId, blob)` cache is a
  drop-in — no plugin changes required.

## 7. Quality & Risks

- **Risk:** unbounded history/churn on huge repos. **Mitigation:** `historyLimit`
  option today; SQLite cache + worker queue on the roadmap.
- **Risk:** `git` output parsing edge cases (root commit, renames). **Mitigation:**
  record-separator parsing; covered by analysis smoke runs.
