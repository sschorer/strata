# Module: `@strata/plugin-git-coupling` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **git-metric**.

## 1. Purpose & Goals

Surface **change coupling** (temporal coupling): pairs of files that keep
changing in the same commit. Where hotspots rank single files by cost, coupling
names dependencies the compiler cannot see — a route and its client, a component
and its fixture — and a coupled pair that straddles a module boundary is an
architectural smell.

## 2. Constraints

- Language-agnostic; history is the only input.
- Reads history only through `RepoContext.git()`.
- Pair counting is quadratic in a commit's file count, so commit size is capped.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the core's git-metric step → `MetricSeries { id: "change-coupling", unit: "%" }`.
- **Manifest:** `strata.plugin.json` (`kind: git-metric`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The plugin: thresholds, then commits → co-changes → ranked points. |
| `commits.ts` | The changed-path set per analysed commit (`git log --name-only -n <N> <sha>`). Root-commit safe; merges contribute nothing. |
| `pairs.ts` | Count per-file changes and per-pair co-changes; skip oversized commits. |
| `coupling.ts` | Coupling degree, thresholds, ranking, and the `MetricPoint` shape. |

## 5. Runtime

`compute(ctx, history)` → one point per surviving pair:

- `subject` — `"a ↔ b"`, `value` — coupling degree in percent,
- `meta` — `fileA`, `fileB`, `sharedChanges`, `changesA`, `changesB`.

Degree averages the two files' change counts:
`100 × shared / ((changesA + changesB) / 2)`.

## 6. Decisions

- **Average, not minimum** (as in code-maat): symmetric, and a constantly
  churning file does not read as coupled to everything it accompanies.
- **Only files present at the analysed revision** are reported — a pair that no
  longer exists is history, not a warning.
- **Commits over 30 files are skipped**: a sweeping rename or format pass
  couples everything to everything, and the pair count is quadratic.
- **Defaults** (`minChanges 3`, `minSharedChanges 2`, `minDegree 30%`, top 500)
  follow code-maat's spirit, loosened so a young repo still shows a signal.
- No `ctx.cache` use: the result is a function of history, not of file contents,
  and the core already caches the whole run by history window.

## 7. Quality & Risks

- **Risk:** generated files (lockfiles) couple to everything that touches them.
  **Mitigation:** ignore-globs for metrics (backlog).
- **Risk:** renames read as a deleted and an added path, splitting a file's
  history. **Mitigation:** follow renames once the git layer exposes them.
- **Risk:** thresholds are fixed. **Mitigation:** expose them as project
  settings when *Project settings → Metrics* lands.
