# Writing a plugin

A plugin is a package with:

1. a `strata.plugin.json` manifest, and
2. a module whose **default export** is built with one of the `define*` helpers
   from `@strata/sdk`.

The core loads the manifest, checks the `sdk` major matches, imports `main`,
and registers the default export by its `kind`. It does not have to live in
this repo — see [Installing a plugin](#installing-a-plugin).

## Manifest

```json
{
  "id": "strata-language-python",
  "name": "Python",
  "kind": "language",
  "version": "0.1.0",
  "sdk": "0.1.0",
  "main": "./dist/index.js",
  "description": "Dependency graph and dead code for Python."
}
```

## The four kinds

### Language plugin

```ts
import { defineLanguagePlugin } from '@strata/sdk';

export default defineLanguagePlugin({
  extensions: ['py'],
  async analyze(ctx) {
    // ctx.files is already filtered to your extensions
    return { graph: { nodes: [], edges: [], cycles: [] }, deadCode: [], metrics: [] };
  },
});
```

Route real parsing through **tree-sitter** for accuracy. Return the standard
`LanguageAnalysis` shape and the UI renders it for free.

### Commit-convention plugin

```ts
import { defineCommitConventionPlugin } from '@strata/sdk';

export default defineCommitConventionPlugin({
  convention: 'gitmoji',
  parse(commit) {
    /* → { type, scope, breaking, subject, tags, valid } */
  },
});
```

### Git-metric plugin

```ts
import { defineGitMetricPlugin } from '@strata/sdk';

export default defineGitMetricPlugin({
  id: 'change-coupling',
  async compute(ctx, history) {
    /* → MetricSeries { id, label, points } */
  },
});
```

### AI provider

Copy `plugins/ai-provider-template`. Implement `listModels()` and `chat()`
(and optionally `embed()`), reading credentials from the environment. Point it
at any OpenAI-compatible endpoint, or a native SDK for other providers.

## Incremental analysis

Every `RepoContext` carries a `cache` scoped to your plugin and keyed on
`(pluginId, pluginVersion, blob)` — a git blob sha is a content hash, so an
entry stays valid until the file itself changes, and bumping your version
invalidates your own entries. Using it is **opt-in**: a plugin that never calls
`cache.file()` recomputes every file on every run. Wrap the expensive per-file
work in it:

```ts
const scanned = await ctx.cache.file(file, async (f) => {
  const text = await f.read();
  return { loc: text.split('\n').length, imports: scan(text) };
});
```

Rules of the road:

- `compute` must depend on **that file's contents only**. Anything else — other
  files, git history, the clock, env vars — will be served stale on the next
  run. Keep whole-set work (resolving an import to a path, cycle detection)
  outside the cached value.
- The value is stored as JSON, so it must be JSON-serialisable.
- Bump your plugin's `version` when its analysis changes: the version is part of
  the key, so a bump invalidates exactly your entries. (`DELETE /cache` or
  `STRATA_CACHE=0` are the manual escape hatches during development.)
- Don't branch on availability — when caching is off, `ctx.cache.file()` is a
  pass-through that just calls `compute`.

The core also caches whole plugin results, so if nothing in your input changed
you won't be called at all.

## Installing a plugin

Third-party plugins are **drop-in**: one directory per plugin under the user
plugins directory, each holding its `strata.plugin.json`.

```
~/.strata/plugins/            # $STRATA_PLUGINS_DIR
├── strata-language-python/
│   ├── strata.plugin.json
│   └── dist/index.js
└── strata-metric-coupling/   # a symlink to a checkout works too
```

```bash
STRATA_PLUGINS_DIR=~/.strata/plugins pnpm --filter @strata/server start
curl -s localhost:4000/plugins   # → { directory, plugins[], failures[] }
```

The directory defaults to `<cwd>/.strata/plugins` (in the container,
`/app/.strata/plugins` — mount a volume there). A directory that does not exist
means "nothing installed", not an error. Only the immediate subdirectories are
scanned; nesting is not searched.

What the loader enforces, because a drop-in plugin is not first-party code:

- Every manifest field is validated, and the `kind` must be one of the four.
- `main` is resolved **inside the plugin's own directory** — it may not point
  anywhere else on the host.
- The exported `kind` must match the manifest's.
- Ids are unique and **first one wins**; built-ins load first, so a drop-in can
  never take over an id Strata ships with.
- A plugin that trips any of these is skipped, not fatal. It shows up in
  `failures[]` on `GET /plugins` (and as a warning on startup) with the reason.

Imports are resolved from the plugin's own directory, so ship it built, with
its runtime dependencies bundled or vendored next to it. `@strata/sdk`'s
`define*` helpers are compile-time only — nothing in a built plugin needs to
import the SDK at runtime.

`GET /plugins` also tags each entry with `source: "builtin" | "user"`, which is
what *Settings → Plugins & engine* renders.

## Local development

```bash
pnpm --filter @strata/plugin-<name> build
```

First-party plugins in this repo are auto-discovered by `@strata/server`. To
test a plugin developed elsewhere, symlink its directory into the plugins
directory and restart — discovery follows symlinks, so a rebuild is all that is
needed between runs. Discovery happens once at startup.

## Versioning

`strata.plugin.json.sdk` must share a major with the running SDK. Breaking a
published contract in `@strata/sdk` means a major bump and a migration note.
