# Merge trust lives in a vouched file, not a GitHub team

Contributors are granted the power to unblock merges by being listed in `.github/vouched.json`, edited by a `/vouch @user` issue command, rather than by being added to a GitHub team or given repository write access.

Teams need an organisation; this is a personal repository. The file also makes every grant a commit — who vouched for whom, and when, is in the history and reviewable like anything else.

## Consequences

The vouch bot needs push access to `main`, which collides with branch protection; a bypass entry or a PR-mode fallback is the documented mitigation. `dependabot[bot]` is vouched only for the self-merge half — a bot never files a review, so the approval path would strand its weekly bumps.
