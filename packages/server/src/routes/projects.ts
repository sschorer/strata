import type { FastifyInstance } from 'fastify';
import { DuplicateRootError, gitUtil, type Project } from '@strata/core';
import type { RouteContext } from './context.js';
import { httpError } from './http-error.js';
import { requirePatch } from './patch.js';

interface AddBody {
  name: string;
  root: string;
}

interface UpdateBody {
  name?: string;
  root?: string;
}

interface IdParams {
  id: string;
}

const identity = {
  name: { type: 'string', minLength: 1, maxLength: 100 },
  root: { type: 'string', minLength: 1 },
};

const addSchema = {
  body: {
    type: 'object',
    required: ['name', 'root'],
    additionalProperties: false,
    properties: identity,
  },
};

const idParams = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 1 } },
};

const idSchema = { params: idParams };

const updateSchema = {
  params: idParams,
  body: {
    type: 'object',
    additionalProperties: false,
    properties: identity,
  },
};

/**
 * The project registry: what the sidebar switcher lists, what *Add project*
 * writes, what *Project settings → General* renames or re-points, and what
 * *Danger zone → Remove project* drops. Removing an entry is a registry
 * operation only — the repository on disk is never touched.
 *
 * Identity only. What an analysis of a project *does* is its config, one level
 * down at `/projects/:id/config`.
 */
export function projectsRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.get('/projects', async () => ({ projects: ctx.projects.list() }));

  app.get<{ Params: IdParams }>(
    '/projects/:id',
    { schema: idSchema },
    async (req) => found(ctx.projects.get(req.params.id), req.params.id),
  );

  app.post<{ Body: AddBody }>(
    '/projects',
    { schema: addSchema },
    async (req, reply) => {
      const root = await repoRoot(req.body.root);
      try {
        const project = ctx.projects.add({ name: req.body.name, root });
        reply.code(201);
        return project;
      } catch (err) {
        if (err instanceof DuplicateRootError) {
          throw httpError(409, err.message);
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    '/projects/:id',
    { schema: updateSchema },
    async (req) => {
      const { id } = req.params;
      requirePatch(req.body, 'field');
      // A new root is resolved exactly like a registered one, so re-pointing a
      // project cannot store something *Add project* would have refused.
      const root =
        req.body.root === undefined
          ? undefined
          : await repoRoot(req.body.root);
      try {
        const update = { name: req.body.name, root };
        return found(ctx.projects.update(id, update), id);
      } catch (err) {
        if (err instanceof DuplicateRootError) {
          throw httpError(409, err.message);
        }
        throw err;
      }
    },
  );

  app.delete<{ Params: IdParams }>(
    '/projects/:id',
    { schema: idSchema },
    async (req) => {
      if (!ctx.projects.remove(req.params.id)) {
        throw httpError(404, `No project "${req.params.id}".`);
      }
      return { removed: true };
    },
  );
}

/**
 * Store the repository, not the path that was typed: a subdirectory analyses
 * the whole repo anyway, so it would register a second entry for a project
 * that is already there.
 */
async function repoRoot(path: string): Promise<string> {
  const root = await gitUtil.toplevel(path);
  if (root === null) {
    throw httpError(400, `${path} is not inside a git repository.`);
  }
  return root;
}

function found(project: Project | undefined, id: string): Project {
  if (!project) throw httpError(404, `No project "${id}".`);
  return project;
}
