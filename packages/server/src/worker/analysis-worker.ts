import { parentPort, workerData } from 'node:worker_threads';
import { Strata } from '@strata/core';
import { buildRegistry, type RegistryOptions } from '../registry.js';
import type { WorkerCommand, WorkerEvent } from './protocol.js';

/**
 * The analysis thread.
 *
 * It owns the plugins it runs and the incremental cache they write to, and
 * shares nothing with the HTTP thread but a message port — which is the whole
 * point: parsing a large repository is minutes of synchronous work, and it must
 * not be minutes during which `/health` goes unanswered.
 *
 * One command at a time is all this ever sees: the queue on the other side
 * serialises them, so the cache has a single writer and there is no lock to
 * take here.
 */

const port = parentPort;
if (!port) {
  throw new Error('analysis-worker.js must be started as a worker thread.');
}

// Plugins load once, when the thread starts, and stay loaded for its lifetime —
// as they do on the HTTP side. Commands sent before this finishes wait in the
// port's queue; the listener below is what starts draining it.
const registry = await buildRegistry(workerData as RegistryOptions);
const strata = new Strata(registry);

port.on('message', (command: WorkerCommand) => void handle(command));

async function handle(command: WorkerCommand): Promise<void> {
  const { id } = command;
  try {
    if (command.type === 'clear-cache') {
      strata.clearCache();
      send({ type: 'done', id });
      return;
    }
    const report = await strata.analyze(command.options, (progress) =>
      send({ type: 'progress', id, progress }),
    );
    send({ type: 'done', id, report });
  } catch (err) {
    // A plugin that throws costs its run, not the thread: the next command is
    // answered by the same warm registry and the same open cache.
    send({ type: 'failed', id, message: (err as Error).message });
  }
}

function send(event: WorkerEvent): void {
  port?.postMessage(event);
}
