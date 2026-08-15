import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  memoryProjectStore,
  type PluginRegistry,
  type ProjectStore,
  type Strata,
} from '@strata/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectsRoute } from './projects.js';

const exec = promisify(execFile);

/**
 * The registry endpoints behind the sidebar switcher. They run against a real
 * repository, because *Add project* resolves the path it is given through git
 * — that resolution is the part worth testing.
 */

let repo: string;
let plain: string;
let projects: ProjectStore;
let app: FastifyInstance;

beforeAll(async () => {
  repo = await realpath(mkdtempSync(join(tmpdir(), 'strata-projects-api-')));
  mkdirSync(join(repo, 'src'));
  await exec('git', ['init', '-q'], { cwd: repo });
  plain = await realpath(mkdtempSync(join(tmpdir(), 'strata-plain-api-')));
}, 30_000);

afterAll(async () => {
  await app.close();
  rmSync(repo, { recursive: true, force: true });
  rmSync(plain, { recursive: true, force: true });
});

beforeEach(async () => {
  await app?.close();
  projects = memoryProjectStore();
  app = Fastify();
  projectsRoute(app, {
    projects,
    strata: {} as Strata,
    registry: {} as PluginRegistry,
  });
});

async function add(body: Record<string, unknown>) {
  return await app.inject({ method: 'POST', url: '/projects', payload: body });
}

describe('GET /projects', () => {
  it('lists what is registered', async () => {
    await add({ name: 'Strata', root: repo });

    const response = await app.inject({ url: '/projects' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      projects: [
        expect.objectContaining({ id: 'strata', name: 'Strata', root: repo }),
      ],
    });
  });

  it('starts empty', async () => {
    expect((await app.inject({ url: '/projects' })).json()).toEqual({
      projects: [],
    });
  });
});

describe('POST /projects', () => {
  it('registers a repository and answers 201', async () => {
    const response = await add({ name: 'Strata', root: repo });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: 'strata',
      name: 'Strata',
      root: repo,
      lastAnalysis: null,
    });
  });

  it('registers the repository a subdirectory belongs to', async () => {
    const response = await add({ name: 'Strata', root: join(repo, 'src') });

    expect(response.json()).toMatchObject({ root: repo });
  });

  it('refuses a path that is not in a repository', async () => {
    const response = await add({ name: 'Nope', root: plain });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('not inside a git repository');
    expect(projects.list()).toEqual([]);
  });

  it('refuses a root that is already registered', async () => {
    await add({ name: 'Strata', root: repo });

    const response = await add({ name: 'Strata again', root: repo });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('already registered');
    expect(projects.list()).toHaveLength(1);
  });

  it('rejects a body that is incomplete or blank', async () => {
    expect((await add({ root: repo })).statusCode).toBe(400);
    expect((await add({ name: 'Strata' })).statusCode).toBe(400);
    expect((await add({ name: '', root: repo })).statusCode).toBe(400);
  });

  it('does not let the caller choose the id', async () => {
    // Fastify strips what the schema does not declare, so `id` never arrives.
    const response = await add({ name: 'Strata', root: repo, id: 'mine' });

    expect(response.json().id).toBe('strata');
  });
});

describe('GET /projects/:id', () => {
  it('answers with the project, or 404 for an id nobody registered', async () => {
    await add({ name: 'Strata', root: repo });

    const known = await app.inject({ url: '/projects/strata' });
    expect(known.json()).toMatchObject({ id: 'strata', root: repo });

    const missing = await app.inject({ url: '/projects/ghost' });
    expect(missing.statusCode).toBe(404);
  });
});

describe('DELETE /projects/:id', () => {
  it('drops the entry — and nothing else', async () => {
    await add({ name: 'Strata', root: repo });

    const response = await app.inject({
      method: 'DELETE',
      url: '/projects/strata',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ removed: true });
    expect(projects.list()).toEqual([]);
    // The repository itself is untouched: it is still a git working tree.
    await expect(
      exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd: repo }),
    ).resolves.toMatchObject({ stdout: 'true\n' });
  });

  it('answers 404 for an id it did not hold', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/projects/ghost',
    });

    expect(response.statusCode).toBe(404);
  });
});
