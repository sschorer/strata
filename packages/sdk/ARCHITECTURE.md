# Module: `@strata/sdk` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).

## 1. Purpose & Goals

The **public contract** every plugin implements and the core consumes. Defines
the four plugin kinds, their data shapes, and the `define*` helpers. It is the
one module whose stability matters most — a breaking change here ripples to all
plugins.

Goals: a minimal, strongly-typed, SemVer-stable surface.

## 2. Constraints

- No runtime dependencies (types + tiny helper functions only).
- Pure ESM, `strict` TypeScript.
- Backwards compatibility within a major; `SDK_VERSION` is the source of truth.

## 3. Interfaces (Context)

- **Consumed by:** `@strata/core` (registry validates `manifest.sdk` against
  `SDK_VERSION`) and every `plugins/*` package.
- **Exports:** types (`RepoContext`, `LanguageAnalysis`, `ParsedCommit`,
  `MetricSeries`, `AIProvider`, …) and helpers (`defineLanguagePlugin`,
  `defineCommitConventionPlugin`, `defineGitMetricPlugin`, `defineAIProvider`).

## 4. Building Blocks

One module per concern; `index.ts` is a barrel and the only supported import
path (`@strata/sdk`).

| File | Contents |
|------|----------|
| `version.ts` | `SDK_VERSION` |
| `manifest.ts` | `PluginKind`, `PLUGIN_KINDS` (the same list as a value, for loaders), `PluginManifest` |
| `logger.ts` | `Logger` |
| `repo.ts` | `RepoFile`, `RepoContext` |
| `cache.ts` | `PluginCache` — the blob-keyed incremental cache contract |
| `graph.ts` | `GraphNode`, `GraphEdge`, `DependencyGraph` |
| `language.ts` | `LanguagePlugin`, `LanguageAnalysis`, `DeadCodeFinding`, `CodeMetric` |
| `commit.ts` | `CommitConventionPlugin`, `RawCommit`, `ParsedCommit` |
| `metric.ts` | `GitMetricPlugin`, `MetricSeries`, `MetricPoint` |
| `ai.ts` | `AIProvider`, `ChatMessage`, `ChatOptions` |
| `plugin.ts` | `StrataPlugin` — the discriminated union |

## 5. Runtime

Almost none, but not zero: the `define*` helpers merely stamp the `kind`
discriminant so the core can route a plugin without reflection, and
`PLUGIN_KINDS` is the kind list as a value, for loaders validating a manifest.
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

## 7. Quality & Risks

- **Risk:** an accidental breaking change to an exported type. **Mitigation:**
  CodeRabbit path-instruction flags changes here; requires a major bump.
- Keep zero deps to avoid supply-chain surface in the contract package.
