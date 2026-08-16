import { afterEach, describe, expect, it } from 'vitest';
import type { LoadedPluginInfo } from '$lib/api';
import { render } from '$lib/test/render';
import PluginList from './PluginList.svelte';

const plugins: LoadedPluginInfo[] = [
  {
    id: 'strata-language-typescript',
    name: 'TypeScript',
    kind: 'language',
    version: '0.4.0',
    sdk: '0',
    main: 'dist/index.js',
    source: 'builtin',
  },
  {
    id: 'acme-metric-coupling',
    name: 'Change coupling',
    kind: 'git-metric',
    version: '1.2.0',
    sdk: '0',
    main: 'dist/index.js',
    source: 'user',
  },
];

/** The rendered text on one line — the markup wraps where a sentence does not. */
const flat = (node: Element | null) =>
  node?.textContent?.replace(/\s+/g, ' ') ?? '';

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('PluginList', () => {
  it('lists what loaded, with its kind and version', () => {
    ui = render(PluginList, { plugins });

    expect(ui.container.querySelectorAll('li')).toHaveLength(2);
    expect(ui.container.textContent).toContain('TypeScript');
    expect(ui.container.textContent).toContain('strata-language-typescript');
    expect(ui.container.textContent).toContain('language');
    expect(ui.container.textContent).toContain('v0.4.0');
  });

  it('marks the ones that came from outside the image', () => {
    ui = render(PluginList, { plugins });

    expect(ui.container.textContent).toContain('user');
  });

  it('reports plugins that were found but could not be loaded', () => {
    ui = render(PluginList, { plugins, failures: 2 });

    expect(flat(ui.container.querySelector('.text-warn'))).toContain(
      '2 plugins were found but could not be loaded',
    );
  });

  it('waits rather than claiming an empty workbench', () => {
    ui = render(PluginList, { plugins: [], loading: true });

    expect(ui.container.textContent).toContain('Loading plugins…');
  });

  it('says an empty workbench is empty once the answer is in', () => {
    ui = render(PluginList, { plugins: [] });

    expect(ui.container.textContent).toContain('No plugins loaded');
  });

  it('surfaces a server that would not answer', () => {
    ui = render(PluginList, { plugins: [], error: 'Server unreachable' });

    expect(ui.container.textContent).toContain('Server unreachable');
  });
});
