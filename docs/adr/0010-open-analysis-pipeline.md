# The analysis pipeline is an open, dependency-ordered graph of stages

> Status: accepted, not yet implemented. See [ADR-11](0011-sdk-0-2-0-single-break.md) for sequencing.

`Strata.analyze` runs a fixed three-phase pipeline — languages, then history metrics, then commit parsing — with the report's shape and the order both hard-coded. Anything that is not one of those three (architecture fitness, the commit fold) has to be written into the core, which contradicts the claim that the tool grows without the core changing.

Instead: a **stage** is any unit of work in the pipeline. Each declares, in its manifest, what it *consumes* and what it *produces*, and the core topologically orders the stages from those declarations. `Strata.analyze` becomes a scheduler with nothing domain-specific left in it; the built-in language, metric and convention plugins become ordinary stages, as does the commit fold.

## Dependencies are on output types, not plugin ids

A stage declares `consumes: ['graph']`, not `consumes: ['strata-language-typescript']`, and receives every `graph` produced upstream, keyed by producer. A stage therefore never needs to know the installed set: adding a PHP module feeds the rule engine with no configuration anywhere. Ids are used only when a stage genuinely means one specific producer.

The set of **output types** is closed and lives in the SDK, even though the set of stages is open — that is what keeps [ADR-12](0012-repo-owned-config-file.md)'s consumers able to render a report without knowing which stages ran. Adding an output type is an SDK change; adding a stage is not.

## One declaration, three jobs

`consumes` is simultaneously the dependency edge, the cache-key input ([ADR-4](0004-sqlite-blob-keyed-cache.md)) and the type of what arrives. A stage that consumes files also declares a **filter** (extensions or globs) which the *core* applies — not the stage — so the cache key stays "the files this stage actually matched" rather than every file in the repository. A stage filtering itself would force the key to digest the whole tree, and a README edit would invalidate the TypeScript graph on a 50k-file repo.

All of it lives in `strata.plugin.json` rather than on the exported object, so the core can plan a run, order it, and reject an unsatisfiable configuration **without importing any third-party code**. The `define*` helpers cross-check the object against the manifest at load, as `kind` is checked today.

## Exclusive groups

A repository has one commit convention, and "96% conforming" only means something relative to one. A stage may declare `exclusive: '<group>'`; configuration names the active member and the core runs only that one, so the graph sees exactly one producer. This generalises to the second rule engine or the second duplication detector.

## Consequences

The core can no longer know a stage's semantics, so everything it used to know intimately is now declared: inputs, filters, exclusivity. Progress reporting stops hard-coding a step count and becomes the length of the topological order. The built-ins get no privileges beyond the existing id-clash rule — writing the architecture-fitness rule engine against the public contract is the acceptance test for this decision, not a follow-up to it.
