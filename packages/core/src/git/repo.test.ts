import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { toplevel } from './repo.js';

const exec = promisify(execFile);

/**
 * Registering a project resolves the path it was given to the repository that
 * owns it — so a subdirectory, a trailing slash and the root itself all land on
 * one entry, and a path that is no repository at all is refused.
 */

let repo: string;
let plain: string;

beforeAll(async () => {
  repo = await realpath(mkdtempSync(join(tmpdir(), 'strata-repo-')));
  mkdirSync(join(repo, 'src'));
  await exec('git', ['init', '-q'], { cwd: repo });

  plain = await realpath(mkdtempSync(join(tmpdir(), 'strata-plain-')));
}, 30_000);

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
});

describe('toplevel', () => {
  it('resolves the working-tree root', async () => {
    expect(await toplevel(repo)).toBe(repo);
  });

  it('resolves a subdirectory to the repository that owns it', async () => {
    expect(await toplevel(join(repo, 'src'))).toBe(repo);
  });

  it('has no root for a directory outside any repository', async () => {
    expect(await toplevel(plain)).toBeNull();
  });

  it('has no root for a path that does not exist', async () => {
    expect(await toplevel(join(plain, 'nowhere'))).toBeNull();
  });
});
