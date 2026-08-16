import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import type { Project, ProjectConfig } from '$lib/api';
import { ProjectsStore, SELECTION_STORAGE_KEY } from '$lib/projects';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import { ProjectConfigStore } from './config.svelte';
import GeneralScreen from './GeneralScreen.svelte';

/**
 * The *General* section end to end, against a stubbed API. Each test gets its
 * own registry and config store; the analysis store the registry points is the
 * app's single instance, so that one is cleared first.
 */

const strata: Project = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: null,
};

const config: ProjectConfig = {
  rev: 'HEAD',
  historyLimit: null,
  ignore: [],
  paths: [],
  languages: null,
  metrics: null,
  convention: null,
  rules: [],
};

const field = (container: HTMLElement, name: string) =>
  container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((element) =>
    element.textContent?.includes(text),
  )!;

/** What the form is refusing to send, or what the server said about it. */
const alert = (container: HTMLElement) =>
  container.querySelector('[role="alert"]')?.textContent ?? '';

/** Type into a field, as a reader would. */
function type(container: HTMLElement, name: string, value: string): void {
  const input = field(container, name);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function save(container: HTMLElement): void {
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Mount the screen over a registry and a config, and let both arrive. */
async function open(
  routes: Record<string, unknown> = {},
  registered: Project[] = [strata],
) {
  const first = registered[0];
  if (first) localStorage.setItem(SELECTION_STORAGE_KEY, first.id);
  const fetchMock = stubApi({
    '/projects': { projects: registered },
    '/projects/strata/config': config,
    ...routes,
  });
  const projects = new ProjectsStore();
  const configStore = new ProjectConfigStore();
  const ui = render(GeneralScreen, { projects, config: configStore });

  await vi.waitFor(() => {
    expect(projects.status).toBe('ready');
  });
  return { ui, projects, config: configStore, fetchMock };
}

let ui: ReturnType<typeof render>;

beforeEach(() => {
  analysis.select('');
  localStorage.clear();
});

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('GeneralScreen', () => {
  it('shows the project as the registry and its config have it', async () => {
    const opened = await open();
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(field(ui.container, 'name').value).toBe('Strata');
    });
    expect(field(ui.container, 'root').value).toBe('/home/dev/workspace/strata');
    expect(field(ui.container, 'rev').value).toBe('HEAD');
    // The whole history is an empty box, with the placeholder saying so.
    expect(field(ui.container, 'historyLimit').value).toBe('');
  });

  it('shows the root as a mount, not as a field', async () => {
    const opened = await open();
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(field(ui.container, 'root')).toBeTruthy();
    });
    expect(field(ui.container, 'root').readOnly).toBe(true);
  });

  it('offers nothing to save until something is edited', async () => {
    const opened = await open();
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(button(ui.container, 'Save changes')).toBeTruthy();
    });
    expect(button(ui.container, 'Save changes').disabled).toBe(true);

    type(ui.container, 'rev', 'main');

    await vi.waitFor(() => {
      expect(button(ui.container, 'Save changes').disabled).toBe(false);
    });
  });

  it('renames the project through the registry', async () => {
    const opened = await open({
      'PATCH /projects/strata': { ...strata, name: 'Strata core' },
    });
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'name').value).toBe('Strata');
    });

    type(ui.container, 'name', 'Strata core');
    save(ui.container);

    await vi.waitFor(() => {
      expect(opened.projects.current?.name).toBe('Strata core');
    });
    // The name is registry-side, so the config was left alone.
    expect(opened.fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/projects/strata/config'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('writes the revision and the limit to the project config', async () => {
    const saved = { ...config, rev: 'main', historyLimit: 500 };
    const opened = await open({ 'PATCH /projects/strata/config': saved });
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'rev').value).toBe('HEAD');
    });

    type(ui.container, 'rev', 'main');
    type(ui.container, 'historyLimit', '500');
    save(ui.container);

    await vi.waitFor(() => {
      expect(opened.config.config?.historyLimit).toBe(500);
    });
    expect(opened.config.config?.rev).toBe('main');
    expect(ui.container.textContent).toContain('Saved.');
  });

  it('sends the whole history as no limit at all', async () => {
    // A project that has a limit today, whose box the reader clears.
    const opened = await open({
      '/projects/strata/config': { ...config, historyLimit: 500 },
      'PATCH /projects/strata/config': config,
    });
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'historyLimit').value).toBe('500');
    });

    type(ui.container, 'historyLimit', '');
    save(ui.container);

    const body = JSON.stringify({ historyLimit: null });
    await vi.waitFor(() => {
      expect(opened.fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/projects/strata/config'),
        expect.objectContaining({ body }),
      );
    });
  });

  it('answers a limit that is not a count without asking the server', async () => {
    const opened = await open();
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'historyLimit')).toBeTruthy();
    });
    const calls = opened.fetchMock.mock.calls.length;

    type(ui.container, 'historyLimit', 'lots');
    save(ui.container);

    await vi.waitFor(() => {
      expect(alert(ui.container)).toContain('whole number of commits');
    });
    expect(opened.fetchMock.mock.calls.length).toBe(calls);
  });

  it('shows what the server refused', async () => {
    const opened = await open({
      'PATCH /projects/strata': Response.json(
        { message: 'No project "strata".' },
        { status: 404 },
      ),
    });
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'name').value).toBe('Strata');
    });

    type(ui.container, 'name', 'Gone');
    save(ui.container);

    await vi.waitFor(() => {
      expect(alert(ui.container)).toContain('No project');
    });
    expect(opened.projects.current?.name).toBe('Strata');
  });

  it('puts the fields back the way they are stored', async () => {
    const opened = await open();
    ui = opened.ui;
    await vi.waitFor(() => {
      expect(field(ui.container, 'rev').value).toBe('HEAD');
    });

    type(ui.container, 'rev', 'main');
    await vi.waitFor(() => {
      expect(button(ui.container, 'Discard').disabled).toBe(false);
    });
    button(ui.container, 'Discard').click();

    await vi.waitFor(() => {
      expect(field(ui.container, 'rev').value).toBe('HEAD');
    });
  });

  it('says there is nothing to configure without a project', async () => {
    const opened = await open({}, []);
    ui = opened.ui;

    expect(ui.container.textContent).toContain('pick a project');
    expect(ui.container.querySelector('form')).toBeNull();
  });

  it('surfaces a config it could not read, and offers the retry', async () => {
    const opened = await open({
      '/projects/strata/config': Response.json(
        { message: 'projects.db is not readable.' },
        { status: 500 },
      ),
    });
    ui = opened.ui;

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('not readable');
    });
    expect(button(ui.container, 'Try again')).toBeTruthy();
  });
});
