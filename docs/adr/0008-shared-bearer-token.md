# One shared bearer token for the API, opt-in

The HTTP API is authenticated by a single shared secret in `$STRATA_TOKEN`, presented as `Authorization: Bearer <token>` and checked in `onRequest` — before a request is routed, parsed or a path resolved. Everything but `/health` answers 401 without it, unrouted paths included, so the API is no way to enumerate which endpoints exist. Leaving the variable unset keeps the API open, and startup warns every time it is.

A self-hosted workbench has one owner. A secret in the environment is the whole credential: no user store, no session state, and nothing for CI to log into.

## Consequences

The token says *who may call*; the path allow-list (`$STRATA_ROOTS`) says *what any caller may reach*. Neither replaces the other, and holding the token makes a caller trusted, not unconfined. The token is read from the header alone — one in a query string lands in the request log and browser history, and one in a cookie would need a CSRF story. Named, revocable keys are the upgrade path if the workbench ever serves more than one person. The CLI has neither limit, deliberately — see [ADR-14](0014-cli-and-its-trust-model.md).
