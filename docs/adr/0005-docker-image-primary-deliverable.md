# The Docker image is the primary deliverable

Strata ships first as a multi-arch image (`ghcr.io/sschorer/strata`) that mounts repositories read-only, rather than as an npm package, a CLI binary or a desktop app. That matches the stated shape of the product — self-hosted, run over the browser, offline — and it is the one artifact that carries the `git` binary and the WASM grammars the analysis needs without asking the host for them.

## Consequences

Every other target is defined relative to it: CI runs the same image, and the Tauri desktop shell ([ADR-7](0007-web-ui-static-spa.md)) loads the same built web UI from disk. Anything that would require a second service to be deployed alongside it is measured against this — see [ADR-9](0009-worker-thread-analysis-queue.md).
