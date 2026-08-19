# Incremental cache in SQLite, keyed on the git blob sha

Re-analysing an unchanged file is the dominant cost on a large repo, so results are cached in a SQLite file (`node:sqlite`, so no runtime dependency) at two levels: per-file results keyed on `(pluginId, pluginVersion, blob)`, and whole-plugin-run results keyed on a digest of every input.

Keying on the blob sha — a content hash — rather than on a path or an mtime means an entry survives across revisions, branches and even repositories: checking out a branch that reverts a file re-uses the entry from before. Including the plugin version means a new plugin build invalidates its own entries without a migration.

## Consequences

The cache is only as pure as its plugins: a `cache.file()` value that depends on anything beyond that file's contents will go stale, and the contract cannot enforce it. `DELETE /cache` is the escape hatch. A cache that cannot be opened, read or written degrades to a pass-through with one warning — it never fails an analysis.
