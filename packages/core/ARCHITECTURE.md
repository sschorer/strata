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
| `registry.ts` | `PluginRegistry` — load manifests, SDK-major check, `byKind()` / `loadedByKind()`. |
| `cache.ts` | `openAnalysisCache()` — the SQLite incremental cache + key digests. |
| `index.ts` | `Strata` orchestrator + `AnalyzeOptions` / `AnalysisReport`. |

## 5. Runtime

`analyze()`:
1. `resolveRev` → sha; `listFiles` → `RepoFile[]` (blob-keyed).
2. Build `RepoContext`, one `cache` scope per plugin.
3. Route files to `language` plugins by extension — skipping any plugin whose
   input digest already has a stored result.
4. Stream `history`; run `git-metric` plugins (same skip).
5. Parse commits with the first `commit-convention` plugin.
6. Merge into `AnalysisReport`.

## 6. Decisions

- **Extension-based routing** for language plugins (simple, fast).
- **First-registered commit convention wins** (single active convention).
- **Blob sha on every file**, so the cache keys on content, not on paths or
  timestamps.
- **Two cache levels** — a plugin whose entire input digest is unchanged is
  skipped outright; otherwise it re-reads only the blobs that changed, through
  `RepoContext.cache`. Graph-shaped results are not per-file, so the per-file
  level alone would not make a rerun free.
- **The plugin version is part of every key**, so shipping a new plugin build
  invalidates exactly that plugin's entries.
- **`node:sqlite`** over `better-sqlite3` — Node ≥ 24 is already a constraint,
  and the cache stays dependency- and native-build-free.
- **The cache never fails an analysis** — an unwritable database degrades to a
  pass-through with a warning.

## 7. Quality & Risks

- **Risk:** unbounded history/churn on huge repos. **Mitigation:** `historyLimit`
  option and the incremental cache; worker queue on the roadmap.
- **Risk:** a plugin caches a value that depends on more than one file's
  contents, and serves it stale. **Mitigation:** the purity contract is in the
  SDK docs; `analyze({cache: false})` and `DELETE /cache` recover.
- **Risk:** the cache file grows without bound. **Mitigation:** entries carry a
  last-used stamp and are pruned after 30 days on open.
- **Risk:** `git` output parsing edge cases (root commit, renames). **Mitigation:**
  record-separator parsing; covered by analysis smoke runs.
