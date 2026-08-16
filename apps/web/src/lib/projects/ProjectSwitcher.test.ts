import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analysis } from '$lib/analysis';
import type { Project } from '$lib/api';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import ProjectSwitcher from './ProjectSwitcher.svelte';
import { ProjectsStore } from './store.svelte';

/**
 * The dropdown end to end, against a stubbed API. Each test gets its own
 * registry store; the analysis store it points is the app's single instance,
 * so that one is cleared first.
 */

const strata: Project = {
  id: 'strata',
  name: 'Strata',
  root: '/home/dev/workspace/strata',
  addedAt: '2026-08-01T09:00:00.000Z',
  lastAnalysis: {
    rev: '7f80d51cafe',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: new Date().toISOString(),
  },
};

const kernel: Project = {
  id: 'kernel',
  name: 'Kernel',
  root: '/home/dev/workspace/kernel',
  addedAt: '2026-08-04T09:00:00.000Z',
  lastAnalysis: null,
};

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((element) =>
    element.textContent?.includes(text),
  )!;

/** Fill the *Add project* form and submit it, as a reader would. */
function submit(container: HTMLElement, root: string): void {
  const input = container.querySelector<HTMLInputElement>('input[name="root"]')!;
  input.value = root;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  container
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

/** Mount the switcher, let the registry arrive, and open the dropdown. */
async function open(routes: Record<string, unknown> = {}) {
  const fetchMock = stubApi({
    '/projects': { projects: [strata, kernel] },
    ...routes,
  });
  const projects = new ProjectsStore();
  const ui = render(ProjectSwitcher, { projects });

  await vi.waitFor(() => {
    expect(projects.status).toBe('ready');
  });
  button(ui.container, 'Project').click();
  await vi.waitFor(() => {
    expect(ui.container.textContent).toContain('Add project');
  });

  return { ui, projects, fetchMock };
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

describe('ProjectSwitcher', () => {
  it('lists the registered projects with their last run', async () => {
    ({ ui } = await open());

    const text = ui.container.textContent ?? '';
    expect(text).toContain('Strata');
    expect(text).toContain('/home/dev/workspace/strata');
    expect(text).toContain('1.2k files');
    expect(text).toContain('just now');
    // Registered, never analysed.
    expect(text).toContain('Never analysed');
  });

  it('points the workbench at the project that was picked', async () => {
    ({ ui } = await open());

    button(ui.container, 'Strata').click();

    expect(analysis.root).toBe('/home/dev/workspace/strata');
    // A project with a run behind it has nothing left to ask, so the panel
    // closes on the choice.
    await vi.waitFor(() => {
      expect(ui.container.textContent).not.toContain('Add project');
    });
  });

  it('points a project that has never been analysed at its first run', async () => {
    ({ ui } = await open());

    button(ui.container, 'Kernel').click();

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('has not been analysed yet');
    });
    // The run belongs to *Analyze / run*; the switcher only says it is missing.
    const link = [...ui.container.querySelectorAll('a')].find((element) =>
      element.textContent?.includes('Set up the first analysis'),
    );
    expect(link?.getAttribute('href')).toBe('/settings/project/analyze');
  });

  it('registers a repository and lands on it', async () => {
    const added: Project = {
      id: 'demo',
      name: 'demo',
      root: '/home/dev/workspace/demo',
      addedAt: '2026-08-16T12:00:00.000Z',
      lastAnalysis: null,
    };
    const { ui: view, fetchMock } = await open({ 'POST /projects': added });
    ui = view;

    button(ui.container, '+ Add project').click();
    await vi.waitFor(() => {
      expect(ui.container.querySelector('input[name="root"]')).not.toBeNull();
    });

    submit(ui.container, '/home/dev/workspace/demo');

    // The workbench is on the root the *server* resolved, which is the
    // repository — not necessarily the path that was typed.
    await vi.waitFor(() => {
      expect(analysis.root).toBe('/home/dev/workspace/demo');
    });
    // The name was left blank, so the folder in the path names the project.
    const post = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      name: 'demo',
      root: '/home/dev/workspace/demo',
    });
  });

  it('fills the path from the folder browser', async () => {
    const added: Project = {
      id: 'demo',
      name: 'demo',
      root: '/home/dev/demo',
      addedAt: '2026-08-16T12:00:00.000Z',
      lastAnalysis: null,
    };
    const { ui: view, fetchMock } = await open({
      'POST /projects': added,
      '/browse': {
        path: '/home/dev',
        parent: null,
        repo: false,
        roots: ['/home/dev'],
        entries: [{ name: 'demo', path: '/home/dev/demo', repo: true }],
      },
    });
    ui = view;

    button(ui.container, '+ Add project').click();
    await vi.waitFor(() => {
      expect(ui.container.querySelector('input[name="root"]')).not.toBeNull();
    });

    button(ui.container, 'Browse').click();
    await vi.waitFor(() => {
      expect(button(ui.container, 'Select')).toBeTruthy();
    });
    button(ui.container, 'Select').click();

    // The picked folder lands in the field, and the browser closes behind it.
    await vi.waitFor(() => {
      expect(
        ui.container.querySelector<HTMLInputElement>('input[name="root"]')
          ?.value,
      ).toBe('/home/dev/demo');
    });

    ui.container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(analysis.root).toBe('/home/dev/demo');
    });
    const post = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
    )!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({
      name: 'demo',
      root: '/home/dev/demo',
    });
  });

  it('shows what the server said about a repository it will not register', async () => {
    ({ ui } = await open({
      'POST /projects': Response.json(
        { message: '/tmp/notes is not inside a git repository.' },
        { status: 400 },
      ),
    }));

    button(ui.container, '+ Add project').click();
    await vi.waitFor(() => {
      expect(ui.container.querySelector('input[name="root"]')).not.toBeNull();
    });

    submit(ui.container, '/tmp/notes');

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('not inside a git repository');
    });
  });

  it('asks before removing a project, then drops it', async () => {
    const { ui: view, projects } = await open({
      'DELETE /projects/kernel': { removed: true },
    });
    ui = view;

    ui.container
      .querySelector<HTMLButtonElement>('button[aria-label="Remove Kernel"]')!
      .click();

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('Remove from Strata?');
    });
    // Asking is not removing.
    expect(projects.projects).toHaveLength(2);

    button(ui.container, 'Remove').click();

    await vi.waitFor(() => {
      expect(projects.projects).toHaveLength(1);
    });
    expect(ui.container.textContent).not.toContain('Kernel');
  });
});
