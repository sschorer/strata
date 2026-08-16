import { afterEach, describe, expect, it } from 'vitest';
import { render } from '$lib/test/render';
import type { CommitTypeRow } from './commits';
import CommitTypes from './CommitTypes.svelte';

const types: CommitTypeRow[] = [
  { type: 'feat', count: 3, share: 0.6, breaking: 0 },
  { type: 'fix', count: 1, share: 0.2, breaking: 1 },
  { type: 'other', count: 1, share: 0.2, breaking: 0 },
];

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('CommitTypes', () => {
  it('names each type and prints its count and share', () => {
    ui = render(CommitTypes, { types });

    expect(ui.container.textContent).toContain('feat');
    expect(ui.container.textContent).toContain('3');
    expect(ui.container.textContent).toContain('60%');
  });

  it('marks the types that carry a breaking change', () => {
    ui = render(CommitTypes, { types });

    expect(ui.container.querySelector('.text-danger')?.textContent).toContain(
      '1 breaking',
    );
  });

  it('sizes each bar by its share of the window', () => {
    ui = render(CommitTypes, { types });

    const widths = [...ui.container.querySelectorAll('li div[style]')].map(
      (fill) => (fill as HTMLElement).style.width,
    );
    expect(widths).toEqual(['60.0%', '20.0%', '20.0%']);
  });

  it('cuts a long tail and says how much it cut', () => {
    ui = render(CommitTypes, { types, limit: 2 });

    expect(ui.container.querySelectorAll('li')).toHaveLength(2);
    expect(ui.container.textContent).toContain('2 of 3 change types');
  });

  it('says so when the window holds no commits', () => {
    ui = render(CommitTypes, { types: [] });

    expect(ui.container.textContent).toContain('No commits');
  });
});
