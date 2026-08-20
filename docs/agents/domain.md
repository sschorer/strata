# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic. (A single root `CONTEXT.md` is the single-context alternative; this repo is multi-context.)
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. Also check `<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

This is a pnpm workspace, so a "context" is a workspace package rather than a
folder under `src/`. Contexts are `packages/*`, `apps/*` and `plugins/*`:

```
/
├── CONTEXT-MAP.md
├── docs/
│   ├── ARCHITECTURE.md                 ← system-wide arc42
│   └── adr/                            ← system-wide decisions
├── packages/
│   ├── core/
│   │   ├── ARCHITECTURE.md
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                   ← context-specific decisions
│   ├── sdk/…
│   └── server/…
├── apps/
│   └── web/…
└── plugins/
    ├── language-typescript/…
    └── …
```

## What exists today

Every context already has an `ARCHITECTURE.md` (arc42, trimmed) beside its
`src/`, and `docs/ARCHITECTURE.md` covers the system. `CONTEXT-MAP.md` exists
at the root, with a `CONTEXT.md` in `packages/sdk`, `packages/core`,
`packages/server` and `apps/web`; the `plugins/*` contexts have none yet.
`docs/adr/` exists and is authoritative.

`ARCHITECTURE.md` and `CONTEXT.md` are not the same document and neither
replaces the other. Architecture docs describe structure — building blocks,
runtime views, deployment. A `CONTEXT.md` is a glossary: the terms this context
uses, what each one means, and the synonyms it deliberately avoids. Read the
architecture doc for a context you're about to change, whether or not a
`CONTEXT.md` is there yet.

## ADRs live in a table for now

System-wide decisions live as records in `docs/adr/`. The table at the bottom
of `docs/ARCHITECTURE.md` is the index over them, not the storage. ADR-10
onwards are **accepted but not yet implemented** — read them alongside the
architecture doc, which still describes what ships today.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

Until the glossaries exist, `README.md` and `docs/ARCHITECTURE.md` carry the
project's vocabulary — plugin kinds (language / commit-convention /
git-metric), *hotspot*, *coupling*, *context*, *job*, *project*, *run*.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
