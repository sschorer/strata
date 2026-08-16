import { describe, expect, it } from 'vitest';
import type { Project } from '$lib/api';
import { projectEntries, projectEntry } from './entries';

const NOW = Date.parse('2026-08-16T12:00:00.000Z');

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'strata',
    name: 'Strata',
    root: '/home/dev/workspace/strata',
    addedAt: '2026-08-01T09:00:00.000Z',
    lastAnalysis: {
      rev: '7f80d51cafe',
      branch: 'main',
      files: 1240,
      durationMs: 2440,
      finishedAt: '2026-08-16T09:00:00.000Z',
    },
    ...overrides,
  };
}

describe('projectEntry', () => {
  it('carries the last run: how many files, how long ago', () => {
    const entry = projectEntry(project(), NOW);

    expect(entry).toMatchObject({
      id: 'strata',
      name: 'Strata',
      root: '/home/dev/workspace/strata',
      analysed: true,
      files: '1.2k',
      age: '3 h ago',
    });
  });

  it('says so when a project has never been analysed', () => {
    const entry = projectEntry(project({ lastAnalysis: null }), NOW);

    expect(entry.analysed).toBe(false);
    expect(entry.files).toBe('');
    expect(entry.age).toBe('Never analysed');
  });
});

describe('projectEntries', () => {
  it('keeps the registry in the order the server sends it', () => {
    const rows = projectEntries(
      [
        project({ id: 'strata', name: 'Strata' }),
        project({ id: 'kernel', name: 'Kernel', lastAnalysis: null }),
      ],
      NOW,
    );

    expect(rows.map((row) => row.id)).toEqual(['strata', 'kernel']);
  });
});
