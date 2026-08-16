import { describe, expect, it } from 'vitest';
import type { ProjectConfig } from '$lib/api';
import { runWindow } from './run-window';

const project = { root: '/home/dev/workspace/strata' };

function config(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    rev: 'HEAD',
    historyLimit: null,
    ignore: [],
    paths: [],
    languages: null,
    metrics: null,
    convention: null,
    rules: [],
    ...overrides,
  };
}

describe('runWindow', () => {
  it('says what the next run reads', () => {
    const window = runWindow(project, config({ rev: 'main', historyLimit: 500 }));

    expect(window).toEqual({
      root: '/home/dev/workspace/strata',
      rev: 'main',
      historyLimit: 'Last 500 commits',
    });
  });

  it('calls an absent limit the whole history', () => {
    expect(runWindow(project, config()).historyLimit).toBe('Whole history');
  });

  it('abbreviates a long window, and counts one commit as one', () => {
    const limit = (commits: number) =>
      runWindow(project, config({ historyLimit: commits })).historyLimit;

    expect(limit(12_000)).toBe('Last 12k commits');
    expect(limit(1)).toBe('Last 1 commit');
  });
});
