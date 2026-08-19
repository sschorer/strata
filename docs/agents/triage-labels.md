# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Status in this repo

`wontfix` exists already (a GitHub default). The other four are not created
yet — `gh label create <name>` on first use.

## These are orthogonal to `area:` and `priority:`

Triage labels say what an issue *needs next*. The `area:*` and `priority:*`
labels say where it *belongs* and *when* — every issue carries one of each, and
`BACKLOG.md` is organised along them. See `docs/agents/issue-tracker.md`.

A triage pass that reaches `ready-for-agent` or `ready-for-human` on an issue
missing an `area:` or `priority:` should add the missing one, because a
backlog line can't be placed without both.
