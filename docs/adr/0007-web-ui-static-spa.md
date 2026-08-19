# The web UI is a SvelteKit static SPA

`apps/web` builds to plain static files (SvelteKit's static adapter, Tailwind v4) with no server-rendering runtime. Analysis is a local API call against `@strata/server`, so there is nothing for a server-rendered page to do that the browser cannot do itself after load.

## Consequences

The same build serves both deployment targets: the server can serve the files out of the same image ([ADR-5](0005-docker-image-primary-deliverable.md)), and the Tauri desktop shell can load them from disk with no Node process behind them. The static files sit outside the API token ([ADR-8](0008-shared-bearer-token.md)) — a browser has to load the app before it can be asked for a token.
