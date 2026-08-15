import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PluginRegistry } from './registry.js';
import { Strata } from './strata.js';

const exec = promisify(execFile);

/**
 * Run metadata: what the analysis *did*, as opposed to what it found. The
 * workbench header (`main · @ 4c1249e · analyzed 2 min ago · 1.82s`) and the
 * overview stat cards read nothing but this, so it comes back from every run —
 * no plugin needs to be registered for it.
 */

let repo: string;
let strata: Strata;

async function git(args: string[]): Promise<void> {
  await exec('git', args, {
    cwd: repo,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Strata Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Strata Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  });
}

beforeAll(async () => {
  repo = mkdtempSync(join(tmpdir(), 'strata-run-'));
  await git(['init', '-q', '-b', 'main']);
  writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
  writeFileSync(join(repo, 'b.ts'), 'export const b = 2;\n');
  await git(['add', '-A']);
  await git(['commit', '-m', 'feat: initial']);

  strata = new Strata(new PluginRegistry(), { cache: false });
}, 30_000);

afterAll(() => {
  strata.close();
  rmSync(repo, { recursive: true, force: true });
});

describe('run metadata', () => {
  it('reports the branch, the file count and how long the run took', async () => {
    const before = Date.now();
    const report = await strata.analyze({ root: repo });

    expect(report.run.branch).toBe('main');
    expect(report.run.files).toBe(2);
    expect(report.run.durationMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(report.run.finishedAt)).toBeGreaterThanOrEqual(before);
  });

  it('resolves the revision the caller asked for', async () => {
    const report = await strata.analyze({ root: repo, rev: 'main' });

    expect(report.run.branch).toBe('main');
    expect(report.rev).toMatch(/^[0-9a-f]{40}$/);
  });

  it('has no branch when a revision names none', async () => {
    const { rev } = await strata.analyze({ root: repo });
    const report = await strata.analyze({ root: repo, rev });

    expect(report.run.branch).toBeNull();
    expect(report.rev).toBe(rev);
  });
});
