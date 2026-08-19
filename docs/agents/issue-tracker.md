# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in
[`sschorer/strata`](https://github.com/sschorer/strata). Use the `gh` CLI for
all operations — it infers the repo from `git remote -v` when run inside a
clone.

`BACKLOG.md` at the repo root is the same work, grouped and prioritised for a
human reader. Every issue has a backlog line and every backlog line has an
issue; see [Keeping `BACKLOG.md` in sync](#keeping-backlogmd-in-sync) below,
which is a duty, not a nicety.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

### Every issue carries an area and a priority

Two label axes are mandatory on every issue — one `area:*` and one
`priority:*`. They are the axes `BACKLOG.md` is organised along, so an issue
missing either can't be placed in the backlog.

| `area:` label                     | `BACKLOG.md` section          |
| --------------------------------- | ----------------------------- |
| `area:core-platform`              | Core & platform               |
| `area:configuration-persistence`  | Configuration & persistence   |
| `area:git-history-intelligence`   | Git / history intelligence    |
| `area:language-modules`           | Language modules              |
| `area:architecture-fitness`       | Architecture fitness          |
| `area:ai`                         | AI                            |
| `area:web-ui`                     | Web UI (`apps/web`)           |
| `area:ci-delivery`                | CI / delivery                 |
| `area:docs-dx`                    | Docs & DX                     |

`priority:P0` = next, `priority:P1` = soon, `priority:P2` = later — the same
three levels the backlog prints in bold.

The `area:web-ui` section is subdivided in the backlog (*Shell*, *Analysis
screens*, *Project settings*, *Application settings*). There is no label for
the subsection; pick it from the issue's subject when writing the backlog line.

### Issue body shape

Existing issues open with a sentence or two of intent and close with a
provenance line naming the backlog section:

```
So the Docker image is a single deployable workbench.

From `BACKLOG.md` → *CI / delivery*.
```

Follow that shape for new issues.

## Keeping `BACKLOG.md` in sync

`BACKLOG.md` mirrors the issue list. Editing one without the other is what
this section exists to prevent.

- **Creating an issue** → add its backlog line, in the section its `area:`
  label maps to, in priority order within that section. Shape:
  `- [ ] **P1** <title>`, optionally followed by indented prose. Closed/`[x]`
  items sit above open ones in each section, roughly in the order they shipped.
- **Closing an issue** → flip its line to `[x]` and drop the `**P1**` marker
  (shipped items carry no priority), moving it up to the done run of its
  section. Where the shipped thing differs from what was asked, rewrite the
  line to describe what actually landed — the done entries are a record, not a
  wish list.
- **Starting work** → `[~]` marks in progress.
- **Re-prioritising or re-scoping an issue** → update the `priority:*` label
  and the `**P<n>**` marker together.

The legend at the top of `BACKLOG.md` is authoritative for the checkbox
vocabulary: `[ ]` todo · `[~]` in progress · `[x]` done.

When a skill's output would leave the two out of step and it can't make both
edits (for example, it only has permission to comment), say so explicitly
rather than letting the mirror drift silently.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

Dependabot PRs carry the `dependencies` label and are not triage input.

## When a skill says "publish to the issue tracker"

Create a GitHub issue, label it with an `area:` and a `priority:`, and add the
matching `BACKLOG.md` line.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`. Read the issue's backlog section too —
neighbouring lines carry the prose context the issue body compresses.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.

Wayfinder maps and their children are session scaffolding, not roadmap items —
they get no `area:`/`priority:` labels and no `BACKLOG.md` line.
