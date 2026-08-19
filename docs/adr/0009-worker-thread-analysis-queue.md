# Heavy analyses on a worker thread behind an in-process queue

An analysis is minutes of synchronous parsing, and on the HTTP thread that is minutes of an unanswered API. `POST /analyze` therefore puts the request on an in-process queue that runs one job at a time on a `worker_threads` worker owning the plugins and the incremental cache; the HTTP thread never parses anything. Runs are serialised deliberately — they share one cache and one CPU — and an identical request already in flight is joined rather than queued twice.

## Considered Options

A Redis-backed queue (BullMQ) is the conventional answer and was rejected: it means a second service alongside a workbench whose whole shape is one offline container run on the machine it analyses ([ADR-5](0005-docker-image-primary-deliverable.md)). The queue *interface* is independent of where work runs, so spreading runs over machines later means replacing the runner, not the API.

## Consequences

A job outlives the request that asked for it, so `wait: false` plus `GET /jobs/:id` and `GET /jobs/:id/events` let the UI show progress instead of a blocked button, while waiting stays the default so CI and `curl` keep the endpoint they had. Plugins load on both threads — twice the startup cost and memory — which is the price of the two threads sharing no state.
