import { afterEach, describe, expect, it } from 'vitest';
import { render } from '$lib/test/render';
import RunPlugins from './RunPlugins.svelte';
import type { RunPlugin } from './run-plugins';

function entry(overrides: Partial<RunPlugin> = {}): RunPlugin {
  return {
    id: 'strata-language-typescript',
    name: 'TypeScript',
    kind: 'language',
    source: 'builtin',
    runs: true,
    note: '',
    ...overrides,
  };
}

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (node: Element | null) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('RunPlugins', () => {
  it('chips the plugins that take part', () => {
    const hotspots = entry({
      id: 'hotspots',
      name: 'Hotspots',
      kind: 'git-metric',
    });
    ui = render(RunPlugins, { entries: [entry(), hotspots] });

    const chips = ui.container.querySelectorAll('ul:first-of-type > li');
    expect(chips).toHaveLength(2);
    expect(flat(chips[0] ?? null)).toContain('TypeScript');
    expect(flat(chips[0] ?? null)).toContain('language');
  });

  it('marks a plugin that came from outside the image', () => {
    ui = render(RunPlugins, { entries: [entry({ source: 'user' })] });

    expect(ui.container.textContent).toContain('user');
  });

  it('says why a loaded plugin stands by', () => {
    ui = render(RunPlugins, {
      entries: [
        entry(),
        entry({
          id: 'gitmoji',
          name: 'Gitmoji',
          kind: 'commit-convention',
          runs: false,
          note: 'another convention already parses this history',
        }),
      ],
    });

    expect(flat(ui.container)).toContain(
      'Gitmoji stands by — another convention already parses this history',
    );
  });

  it('says so when nothing loaded would take part', () => {
    const php = entry({
      id: 'strata-language-php',
      name: 'PHP',
      runs: false,
      note: 'this project leaves it out',
    });
    ui = render(RunPlugins, { entries: [php] });

    expect(ui.container.textContent).toContain('Nothing loaded takes part');
  });

  it('waits rather than claiming an empty workbench', () => {
    ui = render(RunPlugins, { entries: [], loading: true });

    expect(ui.container.textContent).toContain('Loading plugins…');
  });

  it('says an empty workbench is empty once the answer is in', () => {
    ui = render(RunPlugins, { entries: [] });

    expect(ui.container.textContent).toContain('No plugins loaded');
  });

  it('surfaces a server that would not answer', () => {
    ui = render(RunPlugins, { entries: [], error: 'Server unreachable' });

    expect(ui.container.textContent).toContain('Server unreachable');
  });

  it('says the run will not start at all when a setting names nothing loaded', () => {
    ui = render(RunPlugins, {
      entries: [entry()],
      missing: [
        {
          setting: 'convention' as const,
          kind: 'commit-convention' as const,
          ids: ['commit-gitmoji'],
        },
      ],
    });

    const text = flat(ui.container);
    expect(text).toContain('fails before it starts');
    expect(text).toContain('convention names commit-convention plugin');
    expect(text).toContain('"commit-gitmoji"');
    // Above the chips, which describe a run that is not going to happen.
    expect(ui.container.querySelector('[role="alert"]')).not.toBeNull();
  });
});
