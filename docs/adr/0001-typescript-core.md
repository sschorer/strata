# TypeScript core, not Rust

Strata parses and walks large repositories, which is the kind of work a systems language is usually reached for. We chose TypeScript for the whole stack anyway — core, server, plugins and web UI — because the product's value is in its *plugin surface*, and a contributor adding a language module should not have to cross a language boundary or ship a compiled artifact to do it.

## Consequences

Parsing throughput is bounded by Node rather than by the algorithm, which is why heavy runs sit behind a worker thread ([ADR-9](0009-worker-thread-analysis-queue.md)) and an incremental cache ([ADR-4](0004-sqlite-blob-keyed-cache.md)) rather than behind raw speed. Revisit if profiling says the parser, not the I/O, is the wall.
