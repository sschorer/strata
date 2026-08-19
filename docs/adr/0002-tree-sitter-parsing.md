# tree-sitter for parsing, loaded as WebAssembly

Every language module needs a syntax tree, and one framework with many grammars beats one bespoke parser per language. We use tree-sitter, and load grammars as pre-built `.wasm` through `web-tree-sitter` rather than as native bindings.

## Considered Options

Native tree-sitter bindings are faster, but they need a compiler on the installing machine — which would mean a language plugin could not be a drop-in directory in `STRATA_PLUGINS_DIR`, and the Docker image would carry a build toolchain. Per-language official tooling (the TypeScript compiler API, `nikic/php-parser`) is more accurate per language but gives every module a different shape and a different runtime.

## Consequences

Resolution is ours, not the language toolchain's: tree-sitter reads the syntax, but a TypeScript import still has to be resolved through `tsconfig.json` `paths`/`baseUrl` by hand, and schemes we have not implemented draw no edge.
