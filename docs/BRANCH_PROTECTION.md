# Branch protection & governance

These are repository **settings** (not files), so they must be applied once in
the GitHub UI or via the API — the scaffold ships the workflows and lists that
make them enforceable, but can't toggle the settings for you.

> **Plan note:** required status checks and required reviews on a **private**
> repo need GitHub Pro/Team. If this repo stays free, either make it **public**
> or upgrade. Everything below assumes protection is available.

## Goal

- **You (owner)** and **vouched** reviewers can merge without anyone's approval.
- **Everyone else** needs an approving review from a **vouched** reviewer
  before merging.

## Recommended ruleset (Settings → Rules → Rulesets → New branch ruleset)

Target branch: `main`.

Enable:

1. **Restrict deletions** and **Block force pushes**.
2. **Require a pull request before merging**
   - Required approvals: **1**
   - **Require review from Code Owners** (uses `.github/CODEOWNERS`)
   - Dismiss stale approvals on new commits
3. **Require status checks to pass**
   - Add **`build`** (CI) and **`gate`** (from the *Vouch gate* workflow)
   - Require branches to be up to date before merging
4. **Bypass list → add your account**, and **Dependabot** if you want its
   dependency PRs to merge unattended.
   This is what lets *you* merge without an approval while everyone else is held
   to the rules above. Dependabot is vouched in `.github/vouched.json`, which
   clears the `gate` check — but *Required approvals: 1* is enforced by GitHub
   itself, so its PRs still need the bypass entry here to merge on their own.

## How the two levers combine

- The **required PR review** (+ CODEOWNERS) means a non-owner PR needs an
  approval. Because you're the sole code owner, adding more trusted reviewers is
  done through the **vouch** list, and the **`gate`** check enforces that the
  approval actually came from an owner or a vouched reviewer — even if other
  collaborators exist.
- Your **bypass** entry means the rules don't block you.

## Classic branch protection (alternative)

Settings → Branches → Add rule for `main`:

- ✅ Require a pull request before merging → Require approvals: 1 → Require
  review from Code Owners
- ✅ Require status checks: `build`, `gate`
- ✅ Do not allow bypassing the above settings → then add yourself as an
  exception, **or** leave it off (as repo admin you can still merge).

## Vouch-bot write access

The `/vouch` command commits to `main` from `vouch-command.yml`. If "Block
force pushes / require PR" prevents the Action from pushing, either add the
`github-actions` bot to the ruleset **bypass** list, or switch the workflow to
open a PR instead of pushing directly.
