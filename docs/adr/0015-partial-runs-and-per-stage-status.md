# A stage failure fails its dependents, not the run

> Status: accepted, not yet implemented.

Today any plugin that throws propagates out of `Strata.analyze`, and the worker marks the whole job failed. Once anyone can add a stage ([ADR-10](0010-open-analysis-pipeline.md)), that means a third-party stage dividing by zero discards twenty minutes of successful language analysis.

A failing stage instead fails **itself and everything downstream of it**; unrelated branches still produce output. The dependency graph makes "downstream" precisely computable, which is a second dividend of declaring dependencies by output type.

This is a deliberate inconsistency with [ADR-12](0012-repo-owned-config-file.md)'s rule that a *missing* stage is a hard failure. A missing stage is a configuration error knowable before any work happens; a throwing stage is discovered after most of the work is done.

## The report carries status, not bare outputs

Each stage's entry is an envelope — `ok`, `failed` or `skipped`, with the output present only when `ok`, and `skipped` covering both "the filter matched nothing" and "an upstream failed". A sibling `diagnostics` array was rejected: a consumer must not be able to read an output without seeing that it is absent, and *Dead code* rendering "0 findings" when the stage crashed is the exact failure mode this design exists to prevent.

## Consequences

Every consumer must handle a partial report — the honest shape once anyone can add a stage. A partial run still counts as a run and still refreshes the project's last-run summary, marked partial. **Gates fail on any stage that is not `ok`**, which is what makes non-fatal failures safe. Caching stays per-stage: successful stages persist their results, failed ones cache nothing, so a retry re-runs only what failed.
