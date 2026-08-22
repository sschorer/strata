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
  "sdk": "0.2.0",
  "main": "./dist/index.js",
  "description": "Dependency graph and dead code for Python."
}
```

### Declaring a stage

A manifest may also declare the plugin's **stage** — what it consumes, what it
produces, what files it wants, and what it is exclusive with:

```json
{
  "consumes": ["graph"],
  "produces": "findings",
  "filter": { "extensions": ["py"], "globs": ["src/**/*.pyi"] },
  "exclusive": "python-rules"
}
```

- **`consumes`** — output types, never plugin ids. Every upstream output of each
  type arrives keyed by the plugin that produced it, so a stage consuming
  `graph` works with language modules that did not exist when it was written.
- **`produces`** — the one output type the stage produces. The set is closed:
  `graph`, `metrics`, `findings`, `commits`, `aggregate`. `aggregate` is
  whatever a stage folded for itself, in a shape only it and a consumer that
  means it understand.
- **`filter`** — the files it wants, by extension (bare, no dot) and/or by
  repo-relative glob. The **core** applies it, so the stage sees only what it
  matched and its cache key covers only those files: an unrelated file changing
  does not invalidate it.
- **`exclusive`** — a group of which at most one member runs; configuration
  names the active one. A repository has one commit convention, not several.

All four are static JSON so the core can order the stages and reject a
configuration it cannot satisfy **without importing any plugin code**
([ADR-10](adr/0010-open-analysis-pipeline.md)). They are validated at load, and
where the exported object still says the same thing — a language plugin's
`extensions` against `filter.extensions` — the two must agree.

They are optional today: a plugin that declares none of them runs the way it
always did, by its `kind`. Declaring them is what lets the scheduler place it.

## The three kinds

### Language plugin

```ts
import { defineLanguagePlugin, summariseGraph } from '@strata/sdk';

export default defineLanguagePlugin({
  extensions: ['py'],
  async analyze(ctx) {
    // ctx.files is already filtered to your extensions
    const graph = { nodes: [], edges: [], cycles: [] };
    return { graph, deadCode: [], metrics: [], summary: summariseGraph(graph) };
  },
});
```

Route real parsing through **tree-sitter** for accuracy — the TypeScript plugin
loads `web-tree-sitter` with a pre-built WASM grammar, which keeps installation
free of a native build step and is the pattern to copy. Return the standard
`LanguageAnalysis` shape and the UI renders it for free.

`summary` is the graph's headline numbers — node and edge counts, how many
cycles and how many files they hold, and the busiest node in each direction.
`summariseGraph` counts them for you, so every language module reports them the
same way; fill the shape yourself only if your analyzer already knows better.
A result that arrives without one is summarised by the core, so a plugin built
against an older SDK keeps working.

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
  id: 'code-age',
  async compute(ctx, history) {
    /* → MetricSeries { id, label, points } */
  },
});
```

### Not a kind: AI providers

There is no AI plugin kind. A provider is a **provider instance** — a local
coding-agent CLI, declared in the app settings and stored in `settings.db`
under `ai.providers`, one object per agent:

```jsonc
{
  "id": "codex",              // stable slug; what a provider card addresses
  "name": "Codex",
  "enabled": true,
  "accent": null,             // hex tint for the card, or null for the accent
  "binary": "/usr/bin/codex", // null looks the name up on PATH
  "home": null,               // the agent's own home directory, if it keeps one
  "shadowHome": null,         // account-specific home: its own auth.json, shared state
  "args": [],                 // extra launch arguments, in order
  "env": {},                  // environment for the subprocess (stored as written)
  "models": ["gpt-5-codex"]
}
```

`PATCH /settings` with `{"ai":{"providers":[…]}}` replaces that list whole, so
a settings screen sends back exactly what it shows. Adding a provider is
therefore configuration, not a package — and spawning one is a core concern
([ADR-13](adr/0013-providers-are-configured-instances.md)), so no plugin ever
implements it.

Nothing in an analysis may call a model: a stage that did would be neither
offline nor reproducible for a revision, and the incremental cache would serve
its answer forever. AI features read a *finished* report instead.

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

- Every manifest field is validated, and the `kind` must be one of the three.
  A manifest naming a kind Strata has since dropped (`ai-provider`) is refused
  with what replaced it, rather than as an unknown word.
- The stage declarations are validated **before the entry module is imported**
  — an unknown output type, a filter that could match nothing, an extension
  written `".py"` — because planning a run may not require running third-party
  code.
- `main` is resolved **inside the plugin's own directory** — it may not point
  anywhere else on the host.
- The exported `kind` must match the manifest's, and the export must actually
  implement that kind (a `language` plugin without `analyze()` is refused at
  load rather than throwing mid-analysis). So must anything the manifest
  declared twice: a `filter.extensions` the module's own `extensions` disagrees
  with is refused, because the core plans from the manifest and the module does
  the work.
- Ids are unique and **first one wins**; built-ins load first, so a drop-in can
  never take over an id Strata ships with.
- A plugin that trips any of these is skipped, not fatal. It shows up in
  `failures[]` on `GET /plugins` (and as a warning on startup) with the reason.

Imports are resolved from the plugin's own directory, so ship the plugin built,
with its dependencies resolvable from there — its own `node_modules`, or bundled
into the entry. That includes **`@strata/sdk`**: the `define*` helpers are
ordinary functions that survive compilation, so a plugin built with `tsc` still
imports the SDK at runtime.

`GET /plugins` also tags each entry with `source: "builtin" | "user"`, which is
what *Settings → Plugins & engine* renders.

## Local development

```bash
pnpm --filter @strata/plugin-<name> build
```

First-party plugins are loaded from the `BUILTINS` manifest list in
`packages/server/src/registry.ts` — a new one in this repo needs a line there.
To test a plugin developed elsewhere, symlink its directory into the plugins
directory and restart — discovery follows symlinks, so a rebuild is all that is
needed between runs. Discovery happens once at startup.

## Versioning

`strata.plugin.json.sdk` must share a major with the running SDK. Breaking a
published contract in `@strata/sdk` means a major bump and a migration note.
The SDK is at `0.2.0`, which added the stage declarations above; `0.x` is
deliberate, and the open pipeline gets used in anger before it is promised
([ADR-11](adr/0011-sdk-0-2-0-single-break.md)).
