# Module: `@strata/plugin-commit-conventional` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **stage** — consumes `commits`, produces `commits`, exclusive group
> `commit-convention`.

## 1. Purpose & Goals

Read the analysed history window as [Conventional Commits](https://www.conventionalcommits.org/)
writes it, producing a parsed commit log (`type`, `scope`, `breaking`,
`subject`, `tags` per commit). The default, dogfooded convention — Strata's own
commits are conventional.

## 2. Constraints

- Pure function per message; no I/O, no git, no files.
- Never throws on malformed input — returns `valid: false` instead.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the scheduler → a stage entry keyed
  `strata-commit-conventional`, carrying `ParsedCommit[]`. The commit fold
  consumes it by output type; the same log still reaches `report.commits`.
- **Manifest:** `strata.plugin.json` (`kind: stage`, `consumes: ["commits"]`,
  `produces: "commits"`, `exclusive: "commit-convention"`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The stage: the run's window, mapped through the parser. |
| `parse.ts` | One `RawCommit` → one `ParsedCommit`: header + tags composed. |
| `header.ts` | The `type(scope)!: subject` regex and its result. |
| `tags.ts` | Issue refs (`#123`), `Co-authored-by` trailers, `BREAKING CHANGE:` footer. |

## 5. Runtime

`run(ctx)` maps `ctx.history` — the run's window, newest first, handed to it
because the manifest declares it consumes `commits` — into a parsed log in the
same order. No filter is declared, so the core hands it no files.

## 6. Decisions

- **`consumes: ["commits"]` is how a stage asks for the repository's own log.**
  A `RawCommit` is not an output type and nothing produces one; declaring the
  type is what puts the history window in this stage's hands *and* in its cache
  key, and nobody else's.
- **The exclusive group is `commit-convention`**, shared with every other
  convention: a repository has one, and "96% conforming" only means something
  relative to one. Configuration names the active member; with two loaded and
  none named the run fails rather than a convention nobody chose deciding what
  the history conforms to
  ([ADR-10](../../docs/adr/0010-open-analysis-pipeline.md)).
- **A non-conventional message is parsed, not dropped** — `valid: false` with
  the header line as its subject, so a repository where half the history is
  unconventional can say so.
- Standalone plugin so gitmoji / Jira / custom conventions can replace it
  without touching the core.
- Tags are open (`Record<string,string[]>`) so new extractors add keys freely.

## 7. Quality & Risks

- Covered by `src/index.test.ts`, which drives the stage over a context the
  core would build (type/scope, breaking via `!` and footer, issue extraction,
  invalid messages, log order).
- **Risk:** convention drift. **Mitigation:** extend, or ship an additional
  convention plugin and name it in configuration — the exclusive group makes
  the second one a choice rather than a conflict.
