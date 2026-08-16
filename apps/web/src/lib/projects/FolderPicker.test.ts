import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectoryListing } from '$lib/api';
import { stubApi } from '$lib/test/api';
import { render } from '$lib/test/render';
import FolderPicker from './FolderPicker.svelte';

/**
 * The picker against a server that browses this tree, rooted at `/home/dev`:
 *
 *   /home/dev/        notes/  work/
 *   /home/dev/work/   scratch/  strata/ ← a repository
 */

const ROOT = '/home/dev';

const listing = (
  path: string,
  entries: [name: string, repo: boolean][],
  parent: string | null,
  repo = false,
): DirectoryListing => ({
  path,
  parent,
  repo,
  roots: [ROOT],
  entries: entries.map(([name, isRepo]) => ({
    name,
    path: `${path}/${name}`,
    repo: isRepo,
  })),
});

const tree: Record<string, DirectoryListing> = {
  [ROOT]: listing(ROOT, [['notes', false], ['work', false]], null),
  [`${ROOT}/work`]: listing(
    `${ROOT}/work`,
    [['scratch', false], ['strata', true]],
    ROOT,
  ),
  [`${ROOT}/work/strata`]: listing(
    `${ROOT}/work/strata`,
    [['apps', false]],
    `${ROOT}/work`,
    true,
  ),
};

/** The server: it answers for the tree above and 403s for anything else. */
function stubBrowse(override?: Record<string, unknown>) {
  return stubApi({
    '/browse': (_body: unknown, url: URL) => {
      const path = url.searchParams.get('path') ?? ROOT;
      return (
        tree[path] ??
        Response.json(
          { message: `${path} is not inside a directory Strata may browse.` },
          { status: 403 },
        )
      );
    },
    ...override,
  });
}

const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((element) =>
    element.textContent?.trim().startsWith(text),
  )!;

/** A row of the folder list — its label carries an icon, so match loosely. */
const folder = (container: HTMLElement, name: string) =>
  [
    ...container.querySelectorAll('ul[aria-label="Folders"] li > button:first-child'),
  ].find((element) => element.textContent?.includes(name)) as HTMLButtonElement;

/** Mount the picker and wait for the first listing. */
async function open(initial?: string) {
  const picked: string[] = [];
  const ui = render(FolderPicker, {
    initial,
    onpick: (path: string) => picked.push(path),
  });
  await vi.waitFor(() => {
    expect(ui.container.querySelector('ul[aria-label="Folders"]')).not.toBeNull();
  });
  return { ui, picked };
}

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
});

describe('FolderPicker', () => {
  it('lists the folders of the browse root and marks the repositories', async () => {
    stubBrowse();
    ({ ui } = await open());

    const rows = [...ui.container.querySelectorAll('ul[aria-label="Folders"] li')];
    expect(rows.map((row) => row.textContent?.trim())).toHaveLength(2);
    expect(ui.container.textContent).toContain('notes');
    expect(ui.container.textContent).toContain('work');
    // Nothing here is a repository yet, so nothing offers a one-click select.
    expect(ui.container.textContent).not.toContain('repo');
  });

  it('walks into a folder and back out again', async () => {
    stubBrowse();
    ({ ui } = await open());

    folder(ui.container, 'work').click();
    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('strata');
    });
    // The repository is badged and selectable from here.
    expect(ui.container.textContent).toContain('repo');

    button(ui.container, '↑').click();
    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('notes');
    });
  });

  it('jumps back up the path bar in one click', async () => {
    stubBrowse();
    const opened = await open(`${ROOT}/work/strata`);
    ui = opened.ui;

    const crumbs = [
      ...ui.container.querySelectorAll<HTMLButtonElement>(
        'nav[aria-label="Path"] button',
      ),
    ];
    expect(crumbs.map((crumb) => crumb.textContent?.trim())).toEqual([
      'dev',
      'work',
      'strata',
    ]);

    crumbs[0]!.click();
    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('notes');
    });
  });

  it('picks a repository without stepping into it', async () => {
    stubBrowse();
    const opened = await open(`${ROOT}/work`);
    ui = opened.ui;

    button(ui.container, 'Select').click();

    expect(opened.picked).toEqual([`${ROOT}/work/strata`]);
  });

  it('picks the folder it is showing', async () => {
    stubBrowse();
    const opened = await open(`${ROOT}/work/strata`);
    ui = opened.ui;

    button(ui.container, 'Use this folder').click();

    expect(opened.picked).toEqual([`${ROOT}/work/strata`]);
  });

  it('asks the server again when hidden folders are wanted', async () => {
    const fetchMock = stubBrowse();
    ({ ui } = await open());

    ui.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();

    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes('hidden=true'),
        ),
      ).toBe(true);
    });
  });

  it('shows what the server refused, and the way back', async () => {
    stubBrowse();
    ({ ui } = await open());

    // A folder the stub does not know: the server answers 403.
    folder(ui.container, 'notes').click();

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('may browse');
    });
    expect(button(ui.container, `Back to ${ROOT}`)).toBeTruthy();
  });

  it('says so when the server browses nothing at all', async () => {
    stubApi({
      '/browse': { path: '', parent: null, repo: false, entries: [], roots: [] },
    });
    ui = render(FolderPicker, { onpick: () => {} });

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('STRATA_BROWSE_ROOTS');
    });
  });
});
