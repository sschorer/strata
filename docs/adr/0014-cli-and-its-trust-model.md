# A first-class CLI beside the server, with no path allow-list

> Status: accepted, not yet implemented.

Headless CI mode is a CLI whether or not it is called one: it should read a config file, analyse the repository CI has already checked out, and exit with a code. Asking CI to `docker run` a container for that is ceremony. So `@strata/core` gets two supported entry points — the CLI and the server — and `scripts/analyze.mjs` is retired into one of them.

This only pays for itself if both entry points share **one** config resolver, which is why it depends on [ADR-12](0012-repo-owned-config-file.md): the repository's file is the single description of what a run does, so the CLI and the workbench cannot disagree about a repository's health.

## Exit codes

`0` clean · `1` a gate was violated · `2` Strata could not tell you — a named stage was missing, a stage threw, the config was invalid.

The distinction between `1` and `2` is the difference between "your code got worse" and "the tool broke," which CI treats differently. Collapsing them is how a broken plugin becomes a permanently red build nobody investigates.

## No path allow-list, deliberately

`$STRATA_ROOTS` answers "what may a *remote caller* reach on this machine" ([ADR-8](0008-shared-bearer-token.md)). That question does not exist for a process the user launched from their own shell, in their own repository, with their own privileges. Re-applying it in the CLI would be theatre that mostly produces confusing 403s in CI. `$STRATA_TOKEN` likewise has nothing to authenticate: there is no request.

Recorded because the *absence* is the surprising part — a future reader will find the allow-list in one entry point and not the other and assume it is an oversight.

What does transfer is the plugin trust decision: third-party stages run in-process with the caller's privileges, the same as any linter or test runner, and the CLI's documentation says so plainly.
