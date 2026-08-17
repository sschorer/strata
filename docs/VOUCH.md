# The vouch system

Strata uses a lightweight **vouch** model for merge access, inspired by
community-vouched contribution flows.

## The rule

- **Owners** (listed in `.github/vouched.json` → `owners`) and **vouched
  reviewers** (→ `vouched`) can merge their own PRs without any approval.
- **Everyone else** needs an approving review from an **owner or a vouched
  reviewer** before their PR can merge.

Trust is symmetric: vouching someone says their approval unblocks other
people's PRs, so their own PRs don't need one either. Vouch accordingly.

Two things enforce it together:

1. **Branch protection** requires a passing `gate` check and (optionally) a
   Code Owner review — see [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md).
2. The **Vouch gate** workflow (`.github/workflows/vouch-gate.yml`) fails until
   an owner or vouched reviewer has approved (trusted authors' own PRs pass
   immediately).

## Granting trust

Comment on any issue or PR (owners only):

```
/vouch @username
```

The **Vouch command** workflow adds them to `.github/vouched.json` and commits
it. From then on, that person's approving review unblocks other contributors'
PRs. Revoke with:

```
/unvouch @username
```

## Bots

`dependabot[bot]` is vouched. A bot never files an approving review, so without
the author bypass its weekly dependency PRs would wait on a human forever.

Note that the vouch gate is only **one** of the two levers. If your ruleset also
sets *Require a pull request before merging → Required approvals: 1*, GitHub
enforces that independently of this workflow, and Dependabot's PRs still stall.
To let them merge unattended, add Dependabot to the ruleset's **bypass list**
(Settings → Rules → Rulesets → *Bypass list* → Add → Dependabot) — see
[BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md).

## Why a file, not a GitHub team?

Teams need an organization. A JSON file works on a personal repo, is auditable
in git history, and the `gate` check reads it directly. If you later move Strata
into an org, swap the file lookup for a team-membership check — the workflow is
the only thing that changes.
