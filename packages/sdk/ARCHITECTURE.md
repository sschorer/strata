# Module: `@strata/sdk` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **public contract** every plugin implements and the core consumes. Defines
the three plugin kinds, their data shapes, and the `define*` helpers — and, from
`0.2.0`, the vocabulary of the open pipeline: what a **stage** declares about
itself in its manifest, the closed set of **output types** it may produce, and
the **stage entry** a report carries per stage. It is the one module whose
stability matters most — a breaking change here ripples to all plugins.

Goals: a minimal, strongly-typed, SemVer-stable surface.

## 2. Constraints

- No runtime dependencies (types + tiny helper functions only).
- Pure ESM, `strict` TypeScript.
- Backwards compatibility within a major; `SDK_VERSION` is the source of truth.

## 3. Interfaces (Context)

- **Consumed by:** `@strata/core` (registry validates `manifest.sdk` against
  `SDK_VERSION`) and every `plugins/*` package.
- **Exports:** types (`RepoContext`, `LanguageAnalysis`, `ParsedCommit`,
  `MetricSeries`, `OutputType`, `StageEntry`, …) and helpers
  (`defineLanguagePlugin`, `defineCommitConventionPlugin`,
  `defineGitMetricPlugin`).
- **Not exported:** anything about AI. A provider is a configured instance in
  the app settings and the call surface for one lives inside `@strata/core`
  ([ADR-13](../../docs/adr/0013-providers-are-configured-instances.md)).

## 4. Building Blocks

One module per concern; `index.ts` is a barrel and the only supported import
path (`@strata/sdk`).

| File | Contents |
|------|----------|
| `version.ts` | `SDK_VERSION` |
| `manifest.ts` | `PluginKind`, `PLUGIN_KINDS` (the same list as a value, for loaders), `PluginManifest`, `StageFilter` — including a plugin's stage declarations (`consumes`, `produces`, `filter`, `exclusive`) |
| `logger.ts` | `Logger` |
| `repo.ts` | `RepoFile`, `RepoContext` |
| `cache.ts` | `PluginCache` — the blob-keyed incremental cache contract |
| `graph.ts` | `GraphNode`, `GraphEdge`, `DependencyGraph` |
| `cycle.ts` | `GraphCycle`, `orderedCycles` — a component closed into a walk over real edges |
| `summary.ts` | `GraphSummary`, `DegreeEntry`, `summariseGraph` — a graph's headline numbers |
| `language.ts` | `LanguagePlugin`, `LanguageAnalysis`, `DeadCodeFinding`, `CodeMetric` |
| `commit.ts` | `CommitConventionPlugin`, `RawCommit`, `ParsedCommit` |
| `metric.ts` | `GitMetricPlugin`, `MetricSeries`, `MetricPoint` |
| `output.ts` | `OutputType`, `OUTPUT_TYPES`, `StageOutputs`, `Aggregate` — the closed set of what a stage may produce, and the shape behind each |
| `finding.ts` | `Finding` — one thing a stage found, whichever stage found it |
| `stage.ts` | `StageStatus`, `StageEntry` (+ `StageOk` / `StageFailed` / `StageSkipped`) — a report's per-stage slot |
| `plugin.ts` | `StrataPlugin` — the discriminated union |

## 5. Runtime

Almost none, but not zero: the `define*` helpers merely stamp the `kind`
discriminant so the core can route a plugin without reflection,
`PLUGIN_KINDS` is the kind list as a value, for loaders validating a manifest,
`OUTPUT_TYPES` is the same for the output types a manifest may name,
and `summariseGraph` counts a dependency graph so that every language module
reports the same numbers for the same graph.
Both survive compilation, so a built plugin still imports `@strata/sdk` at
runtime — it must be resolvable from the plugin (see
[`docs/PLUGINS.md`](../../docs/PLUGINS.md)).

## 6. Decisions

- **`define*` helpers over bare objects** — give plugin authors full type
  inference and set `kind` centrally.
- **Discriminated union (`StrataPlugin`)** — lets the registry switch on `kind`
  type-safely.
- **`RepoContext.cache` is always present** — the core injects a pass-through
  when caching is off, so plugins never branch on cache availability.
- **Stage declarations are manifest JSON, not exported members** — the core
  plans a run without importing third-party code
  ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)). Where the exported
  object still says the same thing, the registry cross-checks the two at load,
  as it does `kind`.
- **The output-type set is closed, the stage set is open** — a stage depends on
  an output type, never on another stage's id, so a report stays renderable by a
  consumer that does not know which stages ran. Adding an output type is a
  change here; adding a stage is not.
- **`0.2.0`, deliberately not `1.0.0`** — the contract is real but not yet
  load-bearing for anyone outside this repo
  ([ADR-11](../../docs/adr/0011-sdk-0-2-0-single-break.md)).

## 7. Quality & Risks

- **Risk:** an accidental breaking change to an exported type. **Mitigation:**
  CodeRabbit path-instruction flags changes here; requires a major bump.
- Keep zero deps to avoid supply-chain surface in the contract package.
