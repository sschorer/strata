# The analysed repository owns its analysis config

> Status: accepted, not yet implemented.

What an analysis *does* — scope and ignore globs, which stages run, the commit convention, architecture rules and CI gate thresholds — is declared in a `strata.config.json` checked into the analysed repository. It is authoritative: where a stored setting and the file disagree, the file wins.

The line this draws: **the repository owns its analysis; the workbench owns its own behaviour.** Nothing about one repository belongs in the workbench's databases, and nothing about the workbench belongs in a repository.

The forcing case is CI. A fresh container has no `settings.db`, so gate thresholds edited in a settings screen were unreachable exactly where gates are evaluated — which is why gates move out of `AppSettings` into the file, and why *CI gates* becomes a project screen rather than an app one. A layered merge (file < db < request) was rejected for the same reason: under it a green local run and a red CI run have no single explanation.

## What this leaves in the databases

`projects.db` keeps identity — id, display name, root — and the last-run summary. The project config store disappears entirely: `historyLimit` moves into the file (it describes a repository's history), and `rev` stops being stored configuration at all. A revision is a **run parameter** — the workbench keeps the selected revision as client-side view state, CI passes its checkout, the default is `HEAD`. `settings.db` keeps only what describes this workbench: appearance, plugins directory, third-party loading, the incremental cache, and provider instances.

## Format, and who writes it

JSON with a published `$schema`, not TypeScript. A settings screen has to *round-trip* the file, and an arbitrary TypeScript module cannot be re-serialised; a `.ts` config would also need a transpiling loader in both the CLI and the server, for a tool whose pitch is offline and self-contained. The `$schema` line buys the editor completion that was TS config's real attraction.

The settings screens do edit it — a workbench whose settings screens are all disabled labels is a worse product, and a change that lands in `git diff` is more auditable than one that lands in a database. But repositories are mounted read-only in the shipped image ([ADR-5](0005-docker-image-primary-deliverable.md)), so the server **probes writability per project and degrades**: where the repo is writable the screens edit, where it is not they render read-only with the would-be file content available to copy. The deployment decides, not a second setting. The server writes only the file and never commits.

## Naming stages

Stages are named as a map (`{ enabled?, options? }` per stage id) rather than an allow-list, so unnamed means enabled and there is somewhere for per-stage options to live. This flips today's allow-list semantics: a repository can no longer say "only ever run exactly these," so a newly installed stage can start reporting findings on an untouched repository. That is a report changing, not a build breaking — a failing stage is not fatal ([ADR-15](0015-partial-runs-and-per-stage-status.md)) and gates are opt-in per rule. The alternative was worse: under an allow-list, installing a language module does nothing until every repository's file is edited, and the user concludes the plugin is broken.

## No lock file

Stage versions are not pinned. Cache keys already include a plugin's version, so an upgrade invalidates its own entries rather than mixing results, and a lock file cannot police an audience that installs plugins by dropping a directory into `STRATA_PLUGINS_DIR`. Instead the **report records provenance** — every stage that ran, with its version — which is what makes a comparison between two revisions, or a gate that flipped, explainable.

## A named stage that is missing is a hard failure

Everywhere, in the workbench as well as in CI. The lenient precedent — a project naming an unloaded commit convention gets a warning and an empty parse — is a correctness bug waiting for the *Commit analytics* screen, where "96% valid" and "0% valid because nothing parsed" render through the same path and mean opposite things. Once gates read those numbers, a missing plugin becomes a green build that checked nothing.
