# Writing a plugin

A plugin is a workspace package with:

1. a `strata.plugin.json` manifest, and
2. a module whose **default export** is built with one of the `define*` helpers
   from `@strata/sdk`.

The core loads the manifest, checks the `sdk` major matches, imports `main`,
and registers the default export by its `kind`.

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

## Local development

```bash
pnpm --filter @strata/plugin-<name> build
```

First-party plugins are auto-discovered by `@strata/server`. A user plugins
directory (drop-in third-party plugins) is on the roadmap — the loader
(`PluginRegistry.loadFrom`) already takes an arbitrary manifest path.

## Versioning

`strata.plugin.json.sdk` must share a major with the running SDK. Breaking a
published contract in `@strata/sdk` means a major bump and a migration note.
