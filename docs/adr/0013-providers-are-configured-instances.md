# AI providers are configured instances, not plugins, and never run in the pipeline

`ai-provider` is removed as a plugin kind. `AIProvider`, `defineAIProvider` and the `ai-provider-template` package are deleted; the call surface moves into `@strata/core` as the internal interface the subprocess runtime implements.

The indirection stopped earning anything the moment providers became **local coding-agent CLIs** that Strata spawns rather than HTTP endpoints it calls. `AIProviderInstance` in the app settings is already fully generic over that — binary, launch args, environment, agent home, shadow home, models — so "add a custom provider" needs *configuration*, not code. A plugin kind the orchestrator never looked up was a contract with no implementors but ours.

## AI is never a stage

Nothing in the pipeline may call a model. AI features — explaining a hotspot, natural-language query over a repository — are separate endpoints that read a *finished* report and talk to a spawned agent.

This is a property of stages, not an accident of what is built so far. It preserves three things at once: the constraint that analysis runs without network, the goal that results are reproducible for a given revision (a stage that calls a model is not), and the incremental cache, which digests a stage's declared inputs ([ADR-10](0010-open-analysis-pipeline.md)) and would otherwise serve a stale model answer forever.

## Consequences

Adding a fundamentally new *kind* of provider — something that is not "spawn a binary and talk to it" — is now a core change rather than a plugin. That is the trade, and it is acceptable while every provider on the roadmap is a coding-agent subprocess. The template package's replacement is documentation of the settings shape, not a package.
