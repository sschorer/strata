# One breaking SDK wave to 0.2.0, and deliberately not 1.0.0

> Status: accepted, not yet implemented.

The open pipeline ([ADR-10](0010-open-analysis-pipeline.md)), keying language results by manifest id instead of by a joined extension list, the per-stage status envelope ([ADR-15](0015-partial-runs-and-per-stage-status.md)) and removing the AI provider contract ([ADR-13](0013-providers-are-configured-instances.md)) are each a break of the contract the registry enforces (`SDK_VERSION`, major-checked at load). They ship as **one** bump to `0.2.0` rather than staged across several majors with adapters.

The window is exactly now: the only plugins in existence are the five in this repository, so the blast radius is entirely internal. Staging the changes would mean writing adapters for kinds that are deleted two weeks later.

## Explicitly not 1.0.0

An open pipeline is the kind of design that should be used in anger before it is promised. `0.2.0` says the contract is real but not yet load-bearing for other people. Recording that here so a future reader reads the missing `1.0.0` as restraint rather than neglect.

## Landing order

Each step is independently mergeable and keeps `make check` green:

1. SDK `0.2.0` — manifest fields (`consumes`, `produces`, `filter`, `exclusive`), the output-type union, the stage envelope; `AIProvider` deleted.
2. The core becomes a scheduler; the five built-ins migrate to stages. The report shape changes here.
3. Server and web move to the new report shape.
4. `strata.config.json`, the CLI, and the gates migration out of `settings.db` ([ADR-12](0012-repo-owned-config-file.md), [ADR-14](0014-cli-and-its-trust-model.md)).
5. The architecture-fitness rule engine, written against nothing but the public contract — the acceptance test for ADR-10.
