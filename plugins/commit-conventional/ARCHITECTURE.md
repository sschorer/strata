# Module: `@strata/plugin-commit-conventional` — Architecture (arc42)

> Trimmed arc42, consistent with [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
> Kind: **commit-convention**.

## 1. Purpose & Goals

Parse commit messages that follow the [Conventional Commits](https://www.conventionalcommits.org/)
spec into structured meaning (`type`, `scope`, `breaking`, `subject`, `tags`).
The default, dogfooded convention — Strata's own commits are conventional.

## 2. Constraints

- Pure function `parse(commit) → ParsedCommit`; no I/O.
- Never throws on malformed input — returns `valid: false` instead.

## 3. Interfaces (Context)

- **Depends on:** `@strata/sdk`.
- **Consumed by:** the core's commit-analytics step.
- **Manifest:** `strata.plugin.json` (`kind: commit-convention`, `sdk: 0.2.0`).

## 4. Building Blocks

| File | Responsibility |
|------|----------------|
| `index.ts` | The plugin: compose header + tags into a `ParsedCommit`. |
| `header.ts` | The `type(scope)!: subject` regex and its result. |
| `tags.ts` | Issue refs (`#123`), `Co-authored-by` trailers, `BREAKING CHANGE:` footer. |

## 5. Runtime

`core` calls `parse()` once per `RawCommit`; results feed type/scope/breaking
breakdowns and (later) release notes.

## 6. Decisions

- Standalone plugin so gitmoji / Jira / custom conventions can replace it
  without touching the core.
- Tags are open (`Record<string,string[]>`) so new extractors add keys freely.

## 7. Quality & Risks

- Covered by `src/index.test.ts` (type/scope, breaking via `!` and footer,
  issue extraction, invalid messages).
- **Risk:** convention drift. **Mitigation:** extend, or ship an additional
  convention plugin and select it in config (roadmap).
