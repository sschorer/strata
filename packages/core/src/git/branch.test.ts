import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { branchAt } from './branch.js';

const exec = promisify(execFile);

/**
 * A revision is only sometimes a branch. The run header shows one when there is
 * one and stays quiet otherwise, so what does *not* resolve to a branch matters
 * as much as what does.
 */

let repo: string;
let sha: string;

async function git(args: string[]): Promise<string> {
  const { stdout } = await exec('git', args, {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
  return stdout.trim();
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-branch-'));
  await git(['init', '-q', '-b', 'main']);
  await git(['commit', '-q', '--allow-empty', '-m', 'feat: initial']);
  await git(['tag', 'v1']);
  await git(['branch', 'feature/x']);
  sha = await git(['rev-parse', 'HEAD']);
}, 30_000);

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('branchAt', () => {
  it('names the checked-out branch by default', async () => {
    expect(await branchAt(repo)).toBe('main');
  });

  it('names a branch the caller asked for', async () => {
    expect(await branchAt(repo, 'feature/x')).toBe('feature/x');
  });

  it('has no branch for a raw sha or a tag', async () => {
    expect(await branchAt(repo, sha)).toBeNull();
    expect(await branchAt(repo, 'v1')).toBeNull();
  });

  it('has no branch on a detached HEAD', async () => {
    await git(['checkout', '-q', '--detach', 'HEAD']);
    expect(await branchAt(repo)).toBeNull();
  });
});
