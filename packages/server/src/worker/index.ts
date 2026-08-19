/**
 * Where an analysis actually runs: a worker thread of its own, so the HTTP
 * thread stays free to answer while a repository is being parsed.
 */
export { workerRunner, type WorkerRunnerOptions } from './runner.js';
export { spawnThread, type AnalysisThread, type SpawnThread } from './thread.js';
export type { WorkerCommand, WorkerEvent } from './protocol.js';
