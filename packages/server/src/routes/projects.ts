import type { FastifyInstance } from 'fastify';
import { DuplicateRootError, gitUtil, type Project } from '@strata/core';
import type { RouteContext } from './context.js';
import { httpError } from './http-error.js';

interface AddBody {
  name: string;
  root: string;
}

interface IdParams {
  id: string;
}

const addSchema = {
  body: {
    type: 'object',
    required: ['name', 'root'],
    additionalProperties: false,
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      root: { type: 'string', minLength: 1 },
    },
  },
};

const idSchema = {
  params: {
    type: 'object',
    required: ['id'],
    additionalProperties: false,
    properties: { id: { type: 'string', minLength: 1 } },
  },
};

/**
 * The project registry: what the sidebar switcher lists, what *Add project*
 * writes, and what *Danger zone → Remove project* drops. Removing an entry is
 * a registry operation only — the repository on disk is never touched.
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
      // Store the repository, not the path that was typed: a subdirectory
      // analyses the whole repo anyway, so it would register a second entry
      // for a project that is already there.
      const root = await gitUtil.toplevel(req.body.root);
      if (root === null) {
        throw httpError(
          400,
          `${req.body.root} is not inside a git repository.`,
        );
      }
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

function found(project: Project | undefined, id: string): Project {
  if (!project) throw httpError(404, `No project "${id}".`);
  return project;
}
