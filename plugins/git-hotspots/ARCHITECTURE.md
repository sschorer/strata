# Module: `@strata/plugin-git-hotspots` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **git-metric**.

## 1. Purpose & Goals

Rank files by **change frequency × complexity** to surface where maintenance
cost and defects concentrate (Tornhill's "crime scene" hotspots). The headline
git metric.

## 2. Constraints

- Language-agnostic — must score any repo with zero language deps.
- Reads history only through `RepoContext.git()`.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the core's git-metric step → `MetricSeries { id: "hotspots" }`.
- **Manifest:** `strata.plugin.json` (`kind: git-metric`).

## 4. Building Blocks

- **Churn** — walk back exactly the analysed commits from the newest sha
  (`git log -n <N> <sha>`), counting touches per path. Root-commit safe.
- **Complexity proxy** — indentation-weighted non-blank line count.
- **Score** — `churn × complexity`, sorted descending, with `meta`.

## 5. Runtime

`compute(ctx, history)` → per-file points. Only files that actually churned are
scored.

## 6. Decisions

- **Indentation proxy** keeps the metric dependency-free; a `language` plugin can
  later supply real cyclomatic complexity to replace it.
- Windowed by the same commit count the core used, so history caps apply
  consistently.

## 7. Quality & Risks

- **Risk:** generated files (lockfiles) score high. **Mitigation:** ignore-globs
  for metrics (backlog).
- **Risk:** the proxy over/under-weights some styles. **Mitigation:** swap in
  real complexity once language plugins expose it.
