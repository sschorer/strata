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

| Area | Contents |
|------|----------|
| Shared types | `PluginManifest`, `RepoFile`, `RepoContext`, `Logger`, graph types |
| Language | `LanguagePlugin`, `LanguageAnalysis`, `DeadCodeFinding`, `CodeMetric` |
| Commit | `CommitConventionPlugin`, `RawCommit`, `ParsedCommit` |
| Git metric | `GitMetricPlugin`, `MetricSeries`, `MetricPoint` |
| AI | `AIProvider`, `ChatMessage`, `ChatOptions` |

## 5. Runtime

None — compile-time only. The `define*` helpers merely stamp the `kind`
discriminant so the core can route a plugin without reflection.

## 6. Decisions

- **`define*` helpers over bare objects** — give plugin authors full type
  inference and set `kind` centrally.
- **Discriminated union (`StrataPlugin`)** — lets the registry switch on `kind`
  type-safely.

## 7. Quality & Risks

- **Risk:** an accidental breaking change to an exported type. **Mitigation:**
  CodeRabbit path-instruction flags changes here; requires a major bump.
- Keep zero deps to avoid supply-chain surface in the contract package.
