import Fastify, { type FastifyInstance } from 'fastify';
import {
  AnalysisQueue,
  type AnalysisReport,
  type AnalysisRunner,
  type PluginRegistry,
  type ProjectStore,
  type SettingsStore,
} from '@strata/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { jobsRoute } from './jobs.js';

/**
 * `/jobs` is what makes a run something other than a request that has not come
 * back yet: an id that can be read, listed and followed while the work happens
 * somewhere else. What is tested here is that reading is cheap (no reports in a
 * list), that the stream opens on the state as it is rather than on the next
 * thing to change, and that it ends when the run does.
 */

const report = { rev: 'abc123' } as unknown as AnalysisReport;

/** Runs are held open until the test finishes them, one at a time. */
let finish: ((report: AnalysisReport) => void) | null = null;
let fail: ((err: Error) => void) | null = null;
let step: (() => void) | null = null;

const runner: AnalysisRunner = {
  analyze: (_options, onProgress) =>
    new Promise<AnalysisReport>((resolve, reject) => {
      finish = resolve;
      fail = reject;
      step = () =>
        onProgress({
          stage: 'language',
          detail: 'language-typescript',
          completed: 2,
          total: 6,
        });
    }),
  clearCache: async () => undefined,
  close: async () => undefined,
};

let analyses: AnalysisQueue;
let app: FastifyInstance;

/** Let the queue's chain catch up with whatever was just asked of it. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

/** Let the event-stream handler actually start writing. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** The `data:` payloads of one event-stream body, in order. */
function events(body: string): { event: string; job: { state: string } }[] {
  return body
    .split('\n\n')
    .filter((frame) => frame.startsWith('event:'))
    .map((frame) => {
      const [head = '', ...rest] = frame.split('\n');
      return {
        event: head.slice('event:'.length).trim(),
        job: JSON.parse(rest.join('\n').slice('data:'.length).trim()) as {
          state: string;
        },
      };
    });
}

beforeEach(() => {
  finish = null;
  fail = null;
  step = null;
  analyses = new AnalysisQueue(runner);
  app = Fastify();
  jobsRoute(app, {
    analyses,
    projects: {} as ProjectStore,
    settings: {} as SettingsStore,
    registry: {} as PluginRegistry,
    pluginsDir: '/app/.strata/plugins',
  });
});

afterEach(async () => {
  await app.close();
  await analyses.close();
});

describe('GET /jobs', () => {
  it('lists what the queue remembers, newest first', async () => {
    const first = analyses.submit({ root: '/one' });
    await settle();
    finish?.(report);
    await analyses.settled(first.id);
    const second = analyses.submit({ root: '/two' });
    await settle();

    const response = await app.inject({ url: '/jobs' });

    expect(response.json().jobs.map((j: { id: string }) => j.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it('leaves the reports out of the list', async () => {
    const job = analyses.submit({ root: '/repo' });
    await settle();
    finish?.(report);
    await analyses.settled(job.id);

    const listed = (await app.inject({ url: '/jobs' })).json().jobs[0];

    // Twenty reports is megabytes; whoever wants one asks for it by id.
    expect(listed).not.toHaveProperty('report');
    expect(listed.state).toBe('succeeded');
  });
});

describe('GET /jobs/:id', () => {
  it('answers with the job and, once there is one, its report', async () => {
    const job = analyses.submit({ root: '/repo' });
    await settle();

    const running = await app.inject({ url: `/jobs/${job.id}` });
    expect(running.json().job).toMatchObject({ state: 'running', report: null });

    finish?.(report);
    await analyses.settled(job.id);

    const done = await app.inject({ url: `/jobs/${job.id}` });
    expect(done.json().job.report).toEqual(report);
  });

  it('answers 404 for a job this workbench never had', async () => {
    const response = await app.inject({ url: '/jobs/nobody' });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain('nobody');
  });
});

describe('GET /jobs/:id/events', () => {
  it('opens on the state as it is, then reports every step until it ends', async () => {
    const job = analyses.submit({ root: '/repo' });
    await settle();

    const stream = app.inject({ url: `/jobs/${job.id}/events` });
    await tick();
    step?.();
    finish?.(report);

    const frames = events((await stream).body);
    expect(frames.map((f) => f.event)).toEqual([
      'running',
      'running',
      'succeeded',
    ]);
    // The last frame carries the report, so a reader that followed the run does
    // not have to go back and ask for it.
    expect(frames.at(-1)?.job).toMatchObject({ report: { rev: 'abc123' } });
  });

  it('ends straight away for a job that is already over', async () => {
    const job = analyses.submit({ root: '/repo' });
    await settle();
    finish?.(report);
    await analyses.settled(job.id);

    const frames = events((await app.inject({ url: `/jobs/${job.id}/events` })).body);

    // A reader that connected late is told where the run got to, not left
    // waiting for events that have already been and gone.
    expect(frames.map((f) => f.event)).toEqual(['succeeded']);
  });

  it('reports a failed run as the last thing it says', async () => {
    const job = analyses.submit({ root: '/repo' });
    await settle();

    const stream = app.inject({ url: `/jobs/${job.id}/events` });
    await tick();
    fail?.(new Error('not a git repository'));

    const frames = events((await stream).body);
    expect(frames.at(-1)?.event).toBe('failed');
    expect(frames.at(-1)?.job).toMatchObject({ error: 'not a git repository' });
  });

  it('answers 404 for a job this workbench never had', async () => {
    const response = await app.inject({ url: '/jobs/nobody/events' });

    expect(response.statusCode).toBe(404);
  });
});
