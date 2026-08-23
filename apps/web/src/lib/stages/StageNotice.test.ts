import { afterEach, describe, expect, it } from 'vitest';
import { render } from '$lib/test/render';
import StageNotice from './StageNotice.svelte';
import type { StageTrouble } from './trouble';

const failed: StageTrouble = {
  id: 'strata-language-typescript',
  status: 'failed',
  reason: 'tsconfig.json is not readable',
};
const blocked: StageTrouble = {
  id: 'strata-git-hotspots',
  status: 'skipped',
  reason:
    '"strata-commit-conventional" failed, and this stage consumes what it produces',
  blockedBy: 'strata-commit-conventional',
};
const idle: StageTrouble = {
  id: 'acme-language-go',
  status: 'skipped',
  reason: 'its filter matched no file at this revision',
};

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (node: Element | null) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('StageNotice', () => {
  it('names the stage that failed, what is missing and why', () => {
    ui = render(StageNotice, {
      troubles: [failed],
      what: 'the import graph',
    });

    expect(flat(ui.container)).toContain(
      'strata-language-typescript failed, so the import graph is not knowable',
    );
    expect(flat(ui.container)).toContain('tsconfig.json is not readable');
    expect(ui.container.querySelector('.text-danger')).not.toBeNull();
  });

  it('says a stage that never ran did not run, rather than that it failed', () => {
    ui = render(StageNotice, { troubles: [blocked], what: 'the ranking' });

    expect(flat(ui.container)).toContain(
      'strata-git-hotspots did not run, so the ranking is not in this report',
    );
    // The stage somebody has to fix, named where the empty panel is.
    expect(flat(ui.container)).toContain('strata-commit-conventional');
    expect(ui.container.querySelector('.text-danger')).toBeNull();
    expect(ui.container.querySelector('.text-warn')).not.toBeNull();
  });

  it('tells an upstream failure from having nothing to work on', () => {
    ui = render(StageNotice, { troubles: [blocked, idle] });

    // Both did not run; only one of them is a hole where an answer should be.
    expect(flat(ui.container)).toContain('consumes what it produces');
    expect(flat(ui.container)).toContain(
      'its filter matched no file at this revision',
    );
  });

  it('prints one line per stage', () => {
    ui = render(StageNotice, { troubles: [failed, blocked, idle] });

    expect(ui.container.querySelectorAll('p')).toHaveLength(3);
  });
});
