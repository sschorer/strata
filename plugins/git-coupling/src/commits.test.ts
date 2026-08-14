import type { RawCommit, RepoContext } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import { changedFilesByCommit } from './commits.js';

/** Only `git` is exercised here; the rest of the context is never touched. */
const context = (out: string) =>
  ({ git: vi.fn(async () => out) }) as unknown as RepoContext;

const history = (n: number): RawCommit[] =>
  Array.from({ length: n }, (_, i) => ({
    sha: `sha${i}`,
    author: 'Ada',
    authorEmail: 'ada@example.com',
    date: '2026-01-01T00:00:00Z',
    message: 'chore: work',
  }));

describe('changedFilesByCommit', () => {
  it('groups the paths of each commit and skips ones that list none', () => {
    const ctx = context('\x1e\n\na.ts\nb.ts\n\x1e\n\n\x1e\n\nb.ts\n');

    return expect(changedFilesByCommit(ctx, history(3))).resolves.toEqual([
      ['a.ts', 'b.ts'],
      ['b.ts'],
    ]);
  });

  it('keeps leading and trailing spaces — they are part of the path', async () => {
    const ctx = context('\x1e\n\n leading.ts\ntrailing.ts \nleading.ts\n');

    // Three distinct paths: trimming would merge two of them and break the
    // match against `ctx.files`, which does not trim either.
    await expect(changedFilesByCommit(ctx, history(1))).resolves.toEqual([
      [' leading.ts', 'trailing.ts ', 'leading.ts'],
    ]);
  });

  it('counts a path listed twice in one commit once', async () => {
    const ctx = context('\x1e\n\na.ts\na.ts\nb.ts\n');

    await expect(changedFilesByCommit(ctx, history(1))).resolves.toEqual([
      ['a.ts', 'b.ts'],
    ]);
  });

  it('does not shell out for an empty history', async () => {
    const ctx = context('');

    await expect(changedFilesByCommit(ctx, [])).resolves.toEqual([]);
    expect(ctx.git).not.toHaveBeenCalled();
  });
});
