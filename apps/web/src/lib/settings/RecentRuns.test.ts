import { afterEach, describe, expect, it } from 'vitest';
import type { ProjectAnalysis } from '$lib/api';
import { render } from '$lib/test/render';
import RecentRuns from './RecentRuns.svelte';

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

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (node: Element | null) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('RecentRuns', () => {
  it('lists a run as its revision, branch and what it cost', () => {
    ui = render(RecentRuns, { runs: [run()] });

    const row = flat(ui.container.querySelector('li'));
    expect(row).toContain('7f80d51c');
    expect(row).toContain('main');
    expect(row).toContain('1.2k files');
    expect(row).toContain('2.4 s');
  });

  it('lists them in the order it is given, one row each', () => {
    ui = render(RecentRuns, {
      runs: [run(), run({ finishedAt: '2026-08-15T09:00:00.000Z' })],
    });

    expect(ui.container.querySelectorAll('li')).toHaveLength(2);
  });

  it('says a project with no run behind it has none', () => {
    ui = render(RecentRuns, { runs: [] });

    expect(ui.container.textContent).toContain('No run recorded yet');
  });
});
