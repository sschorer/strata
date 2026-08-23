import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { reportOf } from '$lib/test/report';
import { runDisplay } from './summary';

const now = Date.parse('2026-08-15T12:00:00.000Z');

const report = reportOf({
  rev: '982eb56cafe1234',
  run: {
    status: 'ok',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-15T11:55:00.000Z',
  },
});

describe('runDisplay', () => {
  it('folds the run into the strings the header prints', () => {
    expect(runDisplay(report, now)).toEqual({
      branch: 'main',
      rev: '982eb56c',
      files: '1.2k',
      duration: '2.4 s',
      age: '5 min ago',
    });
  });

  it('calls a revision on no branch detached', () => {
    const detached = {
      ...report,
      run: { ...report.run, branch: null },
    } as AnalysisReport;

    expect(runDisplay(detached, now).branch).toBe('detached');
  });

  it('stays printable when a report carries no run summary', () => {
    const bare = { ...report, run: undefined } as unknown as AnalysisReport;

    expect(runDisplay(bare, now)).toEqual({
      branch: 'detached',
      rev: '982eb56c',
      files: '0',
      duration: '—',
      age: '—',
    });
  });
});
