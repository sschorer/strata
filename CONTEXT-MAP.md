# Context Map

Strata is a pnpm workspace, so a context is a workspace package. Each one that
has resolved vocabulary carries a `CONTEXT.md` beside its `ARCHITECTURE.md`;
the rest get one when their terms are first pinned down.

## Contexts

- [SDK](./packages/sdk/CONTEXT.md) — the contracts a plugin implements
- [Core](./packages/core/CONTEXT.md) — what a run is, what it reads, what it produces
- [Server](./packages/server/CONTEXT.md) — who may call and what they may reach
- [Web](./apps/web/CONTEXT.md) — how the workbench presents a run

`plugins/*` are contexts too; none has a glossary yet. The terms for what a
run *finds* — hotspot, churn, change coupling, dead code, cycle — are defined
in the [system glossary](./docs/ARCHITECTURE.md#12-glossary) until the plugin
that owns each one needs its own.

## Relationships

- **SDK → everything.** The SDK defines *stage*, *output type* and *plugin
  manifest*; Core, the plugins and Web all use those words as the SDK means them.
- **Core → SDK.** Core schedules stages and owns everything about a *run* that
  is not a stage's business: revision resolution, scope, caching, ordering.
- **Server → Core.** The server adds only its own two limits — who may call
  (*API token*) and what any caller may reach (*allow-list root*) — and turns a
  run into a *job*.
- **Web → Core, over the server.** Web adds presentation vocabulary (*screen*,
  *settings scope*) and holds the *selected revision* as view state; it invents
  no analysis terms of its own.
