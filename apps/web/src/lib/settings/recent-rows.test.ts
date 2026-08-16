import { describe, expect, it } from 'vitest';
import type { ProjectAnalysis } from '$lib/api';
import { recentRows } from './recent-rows';

const NOW = Date.parse('2026-08-16T12:00:00.000Z');

function run(overrides: Partial<ProjectAnalysis> = {}): ProjectAnalysis {
  return {
    rev: '7f80d51cafebabe',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-16T09:00:00.000Z',
    ...overrides,
  };
}

describe('recentRows', () => {
  it('reads a run the way the header reads it', () => {
    expect(recentRows([run()], NOW)).toEqual([
      {
        id: '2026-08-16T09:00:00.000Z',
        rev: '7f80d51c',
        branch: 'main',
        files: '1.2k',
        duration: '2.4 s',
        age: '3 h ago',
      },
    ]);
  });

  it('names a revision that sits on no branch', () => {
    expect(recentRows([run({ branch: null })], NOW)[0]?.branch).toBe('detached');
  });

  it('keeps the order it is given', () => {
    const rows = recentRows(
      [run(), run({ finishedAt: '2026-08-15T09:00:00.000Z' })],
      NOW,
    );

    expect(rows.map((row) => row.age)).toEqual(['3 h ago', '1 d ago']);
  });
});
