import type { ParsedCommit, RawCommit, StageContext } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import plugin from './index.js';

const base = {
  sha: 'abc123',
  author: 'Ada',
  authorEmail: 'ada@example.com',
  date: '2026-01-01T00:00:00Z',
};

/**
 * A stage context as the core builds one: no files, because the manifest
 * declares no filter, and the run's history window, which this stage is handed
 * because it declares that it consumes `commits`.
 */
function context(messages: string[]): StageContext {
  const history: RawCommit[] = messages.map((message) => ({
    ...base,
    message,
  }));
  return {
    root: '/repo',
    rev: 'deadbeef',
    files: [],
    git: vi.fn(async () => ''),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cache: { file: (file, compute) => compute(file) },
    inputs: {
      graph: {},
      metrics: {},
      findings: {},
      commits: {},
      aggregate: {},
    },
    history,
  };
}

/** The window this convention made of those messages, in log order. */
async function parse(...messages: string[]): Promise<ParsedCommit[]> {
  return (await plugin.run(context(messages))) as ParsedCommit[];
}

/** The one commit a single-message window parsed to. */
async function one(message: string): Promise<ParsedCommit> {
  const [commit] = await parse(message);
  if (!commit) throw new Error('the stage parsed nothing');
  return commit;
}

describe('conventional-commits stage', () => {
  it('parses type, scope and subject', async () => {
    const r = await one('feat(core): add registry');
    expect(r.valid).toBe(true);
    expect(r.type).toBe('feat');
    expect(r.scope).toBe('core');
    expect(r.subject).toBe('add registry');
    expect(r.breaking).toBe(false);
  });

  it('detects breaking changes via ! and footer', async () => {
    expect((await one('feat!: drop node 18')).breaking).toBe(true);
    expect(
      (await one('refactor: x\n\nBREAKING CHANGE: api moved')).breaking,
    ).toBe(true);
  });

  it('extracts issue refs and marks non-conventional messages invalid', async () => {
    const r = await one('fix: patch leak (#42)\n\ncloses #7');
    expect(r.tags.issues).toEqual(['42', '7']);

    const bad = await one('just some words');
    expect(bad.valid).toBe(false);
    expect(bad.type).toBeNull();
  });

  it('produces one entry per commit, in the order the window holds them', async () => {
    const log = await parse('feat: one', 'fix: two', 'not conventional');

    // Log order, newest first — what the fold downstream counts and dates.
    expect(log.map((c) => c.type)).toEqual(['feat', 'fix', null]);
  });

  it('has nothing to say about a window with no commits in it', async () => {
    expect(await parse()).toEqual([]);
  });
});
