import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { browseRoute } from './browse.js';

/**
 * The folder picker's endpoint. It reads `$STRATA_BROWSE_ROOTS` per request,
 * so the test points that at a tree of its own:
 *
 *   <base>/work/     ← the browse root
 *     repo/.git/
 *     plain/
 *   <base>/secret/   outside it
 */

let base: string;
let root: string;
let app: FastifyInstance;

beforeAll(async () => {
  base = await realpath(mkdtempSync(join(tmpdir(), 'strata-browse-api-')));
  root = join(base, 'work');
  mkdirSync(join(root, 'repo', '.git'), { recursive: true });
  mkdirSync(join(root, 'plain'), { recursive: true });
  mkdirSync(join(base, 'secret'));
  process.env.STRATA_BROWSE_ROOTS = root;

  app = Fastify();
  browseRoute(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  delete process.env.STRATA_BROWSE_ROOTS;
  rmSync(base, { recursive: true, force: true });
});

describe('GET /browse', () => {
  it('lists the browse root when no path is given', async () => {
    const res = await app.inject({ method: 'GET', url: '/browse' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      path: string;
      parent: string | null;
      roots: string[];
      entries: { name: string; repo: boolean }[];
    };
    expect(body.path).toBe(root);
    expect(body.parent).toBeNull();
    expect(body.roots).toEqual([root]);
    expect(body.entries).toEqual([
      { name: 'plain', path: join(root, 'plain'), repo: false },
      { name: 'repo', path: join(root, 'repo'), repo: true },
    ]);
  });

  it('walks into a directory and back out again', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/browse?path=${encodeURIComponent(join(root, 'repo'))}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { repo: boolean; parent: string | null };
    expect(body.repo).toBe(true);
    expect(body.parent).toBe(root);
  });

  it('refuses a path outside the browse roots', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/browse?path=${encodeURIComponent(join(base, 'secret'))}`,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toContain('may browse');
  });

  it('is a 404 for a directory that is not there', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/browse?path=${encodeURIComponent(join(root, 'ghost'))}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it('takes the hidden flag as a flag, not as a string', async () => {
    mkdirSync(join(root, '.tools'), { recursive: true });

    const off = await app.inject({ method: 'GET', url: '/browse' });
    const on = await app.inject({ method: 'GET', url: '/browse?hidden=true' });

    const names = (res: typeof off) =>
      (res.json() as { entries: { name: string }[] }).entries.map((e) => e.name);
    expect(names(off)).not.toContain('.tools');
    expect(names(on)).toContain('.tools');
  });

  it('rejects a path the schema will not take', async () => {
    const res = await app.inject({ method: 'GET', url: '/browse?path=' });

    expect(res.statusCode).toBe(400);
  });
});
