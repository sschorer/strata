import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { allowedDirectory } from './allowed.js';
import { configuredRoots } from './config.js';
import { NoSuchDirectoryError, RootDeniedError } from './errors.js';
import { withinRoots } from './within.js';

/**
 * The allow-list every path from a request is confined to, over a real tree:
 *
 *   <base>/
 *     work/            ← the root
 *       repo/          a directory inside it
 *       link -> repo   a symlink that stays inside
 *       out  -> secret a symlink that leaves
 *       notes.md       a file
 *     secret/          outside the root entirely
 */

let base: string;
let root: string;

beforeAll(async () => {
  base = await realpath(mkdtempSync(join(tmpdir(), 'strata-roots-')));
  root = join(base, 'work');
  mkdirSync(join(root, 'repo'), { recursive: true });
  mkdirSync(join(base, 'secret'));
  writeFileSync(join(root, 'notes.md'), '# not a directory\n');
  symlinkSync(join(root, 'repo'), join(root, 'link'));
  symlinkSync(join(base, 'secret'), join(root, 'out'));
});

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('configuredRoots', () => {
  afterEach(() => {
    delete process.env.STRATA_ROOTS;
    delete process.env.STRATA_BROWSE_ROOTS;
  });

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

  it('reads the environment, and still answers to the old name', () => {
    process.env.STRATA_ROOTS = '/repos';
    expect(configuredRoots()).toEqual(['/repos']);

    // A deployment that only ever set the browse-only name keeps working.
    delete process.env.STRATA_ROOTS;
    process.env.STRATA_BROWSE_ROOTS = '/srv/code';
    expect(configuredRoots()).toEqual(['/srv/code']);
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

describe('allowedDirectory', () => {
  it('answers with the path as it is on disk', async () => {
    await expect(allowedDirectory(join(root, 'repo'), [root])).resolves.toBe(
      join(root, 'repo'),
    );
    // A link that stays inside resolves to what it points at, and passes.
    await expect(allowedDirectory(join(root, 'link'), [root])).resolves.toBe(
      join(root, 'repo'),
    );
  });

  it('refuses a path outside the roots', async () => {
    await expect(
      allowedDirectory(join(base, 'secret'), [root]),
    ).rejects.toBeInstanceOf(RootDeniedError);
  });

  it('refuses a symlink that leaves the roots', async () => {
    // Resolved before it is checked: the link is inside, its target is not.
    await expect(
      allowedDirectory(join(root, 'out'), [root]),
    ).rejects.toBeInstanceOf(RootDeniedError);
  });

  it('refuses everything when no root exists', async () => {
    await expect(allowedDirectory(root, [])).rejects.toBeInstanceOf(
      RootDeniedError,
    );
  });

  it('says "not a directory" only for a path inside a root', async () => {
    await expect(
      allowedDirectory(join(root, 'notes.md'), [root]),
    ).rejects.toBeInstanceOf(NoSuchDirectoryError);
    await expect(
      allowedDirectory(join(root, 'ghost'), [root]),
    ).rejects.toBeInstanceOf(NoSuchDirectoryError);

    // Outside one, a path that is not there is refused like any other outside
    // path: the answer must not say whether it exists.
    await expect(
      allowedDirectory(join(base, 'ghost'), [root]),
    ).rejects.toBeInstanceOf(RootDeniedError);
  });
});
