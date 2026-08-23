# Module: `@strata/plugin-git-hotspots` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **stage** — consumes `commits`, produces `metrics`.

## 1. Purpose & Goals

Rank files by **change frequency × complexity** to surface where maintenance
cost and defects concentrate (Tornhill's "crime scene" hotspots). The headline
git metric.

## 2. Constraints

- Language-agnostic — must score any repo with zero language deps.
- Reads history only through `RepoContext.git()`.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the scheduler → a stage entry keyed `strata-git-hotspots`,
  carrying `MetricSeries { id: "hotspots" }`. The same series still reaches
  `report.metrics`, so the hotspots screen reads what it always did.
- **Manifest:** `strata.plugin.json` (`kind: stage`, `consumes: ["commits"]`,
  `produces: "metrics"`, `filter: { globs: ["**"] }`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The plugin: `churn × complexity`, sorted descending, with `meta`. |
| `churn.ts` | Walk back exactly the analysed commits from the newest sha (`git log -n <N> <sha>`), counting touches per path. Root-commit safe. |
| `complexity.ts` | Indentation-weighted non-blank line count, memoised per blob via `ctx.cache`. |

## 5. Runtime

`run(ctx)` → per-file points, over `ctx.files` (every tracked file, as the
filter asks for) and `ctx.history` (the run's window, because the manifest
declares it consumes the commit log). Only files that actually churned are
scored.

## 6. Decisions

- **Indentation proxy** keeps the metric dependency-free; a `language` plugin can
  later supply real cyclomatic complexity to replace it.
- Windowed by the same commit count the core used, so history caps apply
  consistently.
- **The filter is every file**, and says so rather than being left out: a
  hotspot is whatever churns, in whatever language, and a stage that declared
  no filter would be handed no files at all. The core applies it, so the cache
  key is the file set this stage was actually given
  ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)).

## 7. Quality & Risks

- **Risk:** generated files (lockfiles) score high. **Mitigation:** ignore-globs
  for metrics (backlog).
- **Risk:** the proxy over/under-weights some styles. **Mitigation:** swap in
  real complexity once language plugins expose it.
