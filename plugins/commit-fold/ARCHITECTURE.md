# Module: `@strata/plugin-commit-fold` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **stage** — consumes `commits`, produces `aggregate`.

## 1. Purpose & Goals

Count what a history window adds up to: commits per change **type** and per
**scope**, how much of the window **conforms** to its convention, how many
**breaking changes** it announced, and how busy each **week** was. A convention
says what one commit means; this says what a thousand of them come to — once,
for every reader that would otherwise walk the log itself and reach its own
quietly different answer.

It was a step inside the core until the pipeline could hold it; it is an
ordinary stage now, and the first one that consumes another stage's output
rather than the repository ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)).

## 2. Constraints

- Pure fold over what it is handed; no I/O, no git, no files.
- Never reads a producer by name — the parsed log arrives by output type.
- Its result crosses the wire in a report, so it must be JSON.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the scheduler → a stage entry keyed `strata-commit-fold`,
  carrying `CommitAnalytics`. The same numbers still reach
  `report.commitAnalytics`, so the *Commit analytics* screen and the overview
  cards are unchanged.
- **Manifest:** `strata.plugin.json` (`kind: stage`, `consumes: ["commits"]`,
  `produces: "aggregate"`, no filter).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The stage: the run's window and the parsed log, folded. |
| `log.ts` | `parsedLog()` — which upstream log this fold counts. |
| `analyse.ts` | `analyseCommits()` — the whole fold, in one shape. |
| `buckets.ts` | `bucketBy()` — counts per type / per scope, biggest first. |
| `weeks.ts` | `weeklyActivity()` — commits per Monday-started week (UTC). |
| `types.ts` | `CommitAnalytics`, `CommitBucket`, `CommitWeek`. |

## 5. Runtime

`run(ctx)` reads two things and joins nothing else:

- `ctx.history` — the run's window, newest first, which it is handed because
  the manifest declares it consumes `commits`. It sizes `total` and dates the
  weekly series.
- `ctx.inputs.commits` — every parsed log produced upstream, keyed by the
  plugin that produced it. Conventions are an **exclusive group**, so at most
  one arrives.

Neither fold reads the other's list, so a window nothing parsed still reports
its activity.

## 6. Decisions

- **An `aggregate`, not an output type of its own.** Counting commits is this
  stage's business and a consumer that means it narrows the shape; adding an
  output type for it would be an SDK change for one plugin
  ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)).
- **By output type, never by plugin id** — the fold counts a gitmoji or a Jira
  convention exactly as it counts the conventional one, and never learns which
  is installed.
- **An unjudged history is not a non-conforming one.** With no convention
  loaded nothing is counted as invalid and `validRate` is `0` over nothing,
  rather than every commit being reported as breaking the rules.
- **The unnamed bucket is `null`**, not `"other"` — a repository is free to use
  `other` as a real type, and "no scope" is the residue of a list of scopes
  rather than an entry in it.
- **Weeks start Monday, in UTC.** An author's timezone is whatever their laptop
  said at the time, so bucketing locally would move a commit between columns
  depending on who ran the analysis. Quiet weeks are emitted as zero, because a
  chart that closes its gaps draws a busy repository out of a quiet one.

## 7. Quality & Risks

- Covered by `src/fold.test.ts` (the fold itself) and `src/index.test.ts` (the
  stage over a context the core would build).
- **Risk:** a second stage produces a parsed log despite the exclusive group —
  a third-party stage that declares `produces: "commits"` and no group.
  **Mitigation:** the first log wins rather than the union; two logs over one
  window are two answers, not twice the history.
