# Shell out to `git` rather than link a git library

History, blob shas and tracked-file lists all come from executing the `git` binary and reading its output, not from a JS git implementation such as isomorphic-git.

## Consequences

`git` must be on `PATH` (and in the image) — that is an explicit deployment constraint. In exchange, every repository shape git supports (worktrees, submodules, alternates, partial clones) works on day one, and we never reimplement revision resolution.
