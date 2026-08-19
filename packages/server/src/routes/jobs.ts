import type { FastifyInstance } from 'fastify';
import { jobSummary, type AnalysisJob } from '@strata/core';
import type { RouteContext } from './context.js';
import { httpError } from './http-error.js';
import { openEventStream } from './sse.js';

interface JobParams {
  id: string;
}

/**
 * The analysis queue, as a resource.
 *
 * `POST /analyze` puts a job on it; these three read it back. A run therefore
 * outlives the request that asked for it: a browser can be handed an id, render
 * *Analysing…*, follow the steps as they happen and collect the report at the
 * end — and a reload in the middle of a run finds the run still there.
 */
export function jobsRoute(app: FastifyInstance, ctx: RouteContext): void {
  /**
   * Every job the queue still remembers, newest first, without the reports —
   * a list of twenty of those is megabytes nobody asked for.
   */
  app.get('/jobs', async () => ({
    jobs: ctx.analyses.list().map(jobSummary).reverse(),
  }));

  /** One job, with its report once it has one. */
  app.get<{ Params: JobParams }>('/jobs/:id', async (req) => ({
    job: found(ctx, req.params.id),
  }));

  /**
   * Follow one job until it settles.
   *
   * The current state goes out first, so a reader that connected late — or
   * reconnected after a dropped stream — learns where the run got to without
   * having heard the steps it missed. The event name is the job's state, so a
   * plain `curl` reads as well as the workbench does.
   */
  app.get<{ Params: JobParams }>('/jobs/:id/events', async (req, reply) => {
    const { id } = req.params;
    // Read it before the reply is taken over, so an unknown id is still an
    // ordinary 404 rather than an error with nowhere to go.
    const job = found(ctx, id);

    const stream = openEventStream(req, reply);
    const send = (update: AnalysisJob): void => {
      stream.send(update.state, update);
      if (update.state === 'succeeded' || update.state === 'failed') {
        unwatch();
        stream.close();
      }
    };

    // Subscribe first, then send what was read: nothing has been awaited since,
    // so no change can have slipped between the two.
    const unwatch = ctx.analyses.watch(id, send);
    stream.onClose(() => unwatch());
    send(job);
  });
}

/** The job, or a 404 that says which id was not there. */
function found(ctx: RouteContext, id: string): AnalysisJob {
  const job = ctx.analyses.get(id);
  if (!job) {
    throw httpError(
      404,
      `No analysis job "${id}". Jobs are kept for a while after they finish, ` +
        'not forever.',
    );
  }
  return job;
}
