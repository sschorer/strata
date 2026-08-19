# Core

The orchestrator: what a run is, what it reads, and what it hands back. Core
owns everything about an analysis that is not a single stage's business.

## Language

**Workbench**:
One installation of Strata — the server, its databases, and the plugins it
loaded. It has one owner and knows about several projects.
_Avoid_: instance, tenant, server (the server is a process, not the thing)

**Project**:
A repository this workbench knows about: an id, a display name, a root, and the
summary of its last run. One repository is one project.
_Avoid_: repo entry, workspace

**Run**:
One analysis of one project at one revision. A run is what produces a report.
_Avoid_: analysis (ambiguous between the act and the result), scan

**Revision**:
The commit a run analyses. A run parameter, not stored configuration.
_Avoid_: rev target, branch (a branch names a revision; it is not one)

**Report**:
Everything one run produced: the revision, the run's own facts, and one entry
per stage.

**Stage entry**:
A stage's slot in the report — `ok`, `failed` or `skipped`, carrying the output
only when `ok`. A consumer cannot read an output without seeing that it is
absent.
_Avoid_: stage result, diagnostics

**Partial run**:
A run in which at least one stage failed or was skipped. Still a run, still
recorded, and never a passing gate.

**Provenance**:
The record, in the report, of which stages ran and at which versions — what
makes a comparison between two runs, or a gate that flipped, explainable.

**Job**:
A run on the queue — queued, running, then succeeded or failed. A job outlives
the request that asked for it.

**Analysis config**:
What an analysis of a repository does: scope, stages, convention, architecture
rules, gates. Lives in a file checked into the analysed repository and is
authoritative over anything stored by the workbench.
_Avoid_: project config, project settings (a screen is named that; the concept
belongs to the repository)

**App settings**:
How this workbench behaves — appearance, plugins directory, third-party
loading, the incremental cache, provider instances. Never about one repository.
_Avoid_: global config, preferences

**Gate**:
A threshold that fails a build: a new cycle, a hotspot regression, a violated
enforced rule. A gate belongs to the repository, not to the workbench.

**Architecture rule**:
A declaration that one part of a repository may not depend on another. An
*enforced* rule fails a gate; the rest only report.

**Provider instance**:
A configured local coding-agent CLI the workbench can launch — binary, launch
args, environment, agent home, shadow home, models. Configuration, not a
plugin, and never part of a run.
_Avoid_: AI provider plugin, model backend, endpoint

**Shadow home**:
An account-specific home directory for a provider instance, keeping its
credentials separate while the rest of the agent's state is shared. How one
machine runs two accounts of the same agent.
