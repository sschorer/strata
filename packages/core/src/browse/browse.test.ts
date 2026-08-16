import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BrowseDeniedError, NoSuchDirectoryError } from './errors.js';
import { listDirectory } from './list.js';
import { configuredRoots, withinRoots } from './roots.js';

/**
 * The folder picker's listing, over a real tree:
 *
 *   <base>/
 *     work/            ← the browse root
 *       repo/.git/     a repository
 *       nested/inner/  a plain directory, and one inside it
 *       .hidden/       a dot-directory
 *       link -> repo   a symlink into the root
 *       out  -> secret a symlink out of it
 *       notes.md       a file: never listed
 *     secret/          outside the root entirely
 */

let base: string;
let root: string;

beforeAll(async () => {
  base = await realpath(mkdtempSync(join(tmpdir(), 'strata-browse-')));
  root = join(base, 'work');
  mkdirSync(join(root, 'repo', '.git'), { recursive: true });
  mkdirSync(join(root, 'nested', 'inner'), { recursive: true });
  mkdirSync(join(root, '.hidden'));
  mkdirSync(join(base, 'secret'));
  writeFileSync(join(root, 'notes.md'), '# not a directory\n');
  symlinkSync(join(root, 'repo'), join(root, 'link'));
  symlinkSync(join(base, 'secret'), join(root, 'out'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('configuredRoots', () => {
  it('reads the configured list, absolute and deduplicated', () => {
    expect(configuredRoots(['/repos', '/repos', '/srv/code'].join(delimiter))).toEqual([
      '/repos',
      '/srv/code',
    ]);
  });

  it('falls back to the home directory when nothing is configured', () => {
    expect(configuredRoots('')).toHaveLength(1);
    expect(configuredRoots(undefined)).toEqual(configuredRoots(''));
  });
});

describe('withinRoots', () => {
  it('accepts a root and what is under it', () => {
    expect(withinRoots('/repos', ['/repos'])).toBe(true);
    expect(withinRoots('/repos/strata/src', ['/repos'])).toBe(true);
  });

  it('is not fooled by a name that merely starts the same', () => {
    expect(withinRoots('/repos-private/x', ['/repos'])).toBe(false);
    expect(withinRoots('/', ['/repos'])).toBe(false);
  });
});

describe('listDirectory', () => {
  it('lists subdirectories only, marking the repositories', async () => {
    const listing = await listDirectory({ roots: [root] });

    expect(listing.path).toBe(root);
    expect(listing.entries.map((entry) => entry.name)).toEqual([
      'link',
      'nested',
      'out',
      'repo',
    ]);
    const repos = listing.entries.filter((entry) => entry.repo);
    // The symlink to the repository counts as one; `nested` does not.
    expect(repos.map((entry) => entry.name)).toEqual(['link', 'repo']);
  });

  it('starts at the first root when no path is given', async () => {
    const listing = await listDirectory({ roots: [root, join(base, 'secret')] });

    expect(listing.path).toBe(root);
    expect(listing.roots).toEqual([root, join(base, 'secret')]);
    // Nothing above a root is offered, because nothing above it is browsable.
    expect(listing.parent).toBeNull();
  });

  it('offers the way back up inside a root', async () => {
    const listing = await listDirectory({
      path: join(root, 'nested', 'inner'),
      roots: [root],
    });

    expect(listing.parent).toBe(join(root, 'nested'));
    expect(listing.repo).toBe(false);
  });

  it('says when the directory it listed is itself a repository', async () => {
    const listing = await listDirectory({ path: join(root, 'repo'), roots: [root] });

    expect(listing.repo).toBe(true);
    // `.git` is a dot-directory: it is not listed as somewhere to go.
    expect(listing.entries).toHaveLength(0);
  });

  it('hides dot-directories unless they are asked for', async () => {
    const shown = await listDirectory({ roots: [root], hidden: true });

    expect(shown.entries.map((entry) => entry.name)).toContain('.hidden');
  });

  it('refuses a path outside the roots', async () => {
    await expect(
      listDirectory({ path: join(base, 'secret'), roots: [root] }),
    ).rejects.toBeInstanceOf(BrowseDeniedError);
  });

  it('refuses a symlink that leaves the roots', async () => {
    // Resolved before it is checked: the link is inside, its target is not.
    await expect(
      listDirectory({ path: join(root, 'out'), roots: [root] }),
    ).rejects.toBeInstanceOf(BrowseDeniedError);
  });

  it('refuses a file, and a path that is not there', async () => {
    await expect(
      listDirectory({ path: join(root, 'notes.md'), roots: [root] }),
    ).rejects.toBeInstanceOf(NoSuchDirectoryError);
    await expect(
      listDirectory({ path: join(root, 'ghost'), roots: [root] }),
    ).rejects.toBeInstanceOf(NoSuchDirectoryError);
  });

  it('browses nothing when no root exists', async () => {
    const listing = await listDirectory({ roots: [] });

    expect(listing).toEqual({
      path: '',
      parent: null,
      repo: false,
      entries: [],
      roots: [],
    });
  });
});
