import type { FastifyInstance } from 'fastify';
import {
  InvalidConfigError,
  type ProjectConfig,
  type ProjectConfigPatch,
} from '@strata/core';
import type { RouteContext } from './context.js';
import { httpError } from './http-error.js';
import { requirePatch } from './patch.js';
import { requireKnownPlugins } from './plugin-ids.js';

interface IdParams {
  id: string;
}

const params = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: { id: { type: 'string', minLength: 1 } },
};

const strings = { type: 'array', items: { type: 'string' } };

const patchSchema = {
  params,
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      rev: { type: 'string', minLength: 1 },
      historyLimit: { type: ['integer', 'null'], minimum: 1 },
      ignore: strings,
      paths: strings,
      languages: { ...strings, type: ['array', 'null'] },
      metrics: { ...strings, type: ['array', 'null'] },
      convention: { type: ['string', 'null'], minLength: 1 },
      rules: {
        type: 'array',
        items: {
          type: 'object',
          required: ['from', 'to'],
          additionalProperties: false,
          properties: {
            from: { type: 'string', minLength: 1 },
            to: { type: 'string', minLength: 1 },
            enforced: { type: 'boolean', default: false },
          },
        },
      },
    },
  },
};

/**
 * What an analysis of one project does: revision, history window, scope,
 * which plugins run, the commit convention and the architecture rules — the
 * *Project settings* screens, minus identity. Display name and root belong to
 * the registry entry (`PATCH /projects/:id`), because the root has to stay
 * unique across projects and this is not the place that can promise that.
 *
 * `PATCH` merges: a field left out keeps its value, and one that is sent
 * replaces it whole (an array is the new list, not an addition to the old).
 */
export function projectConfigRoute(
  app: FastifyInstance,
  ctx: RouteContext,
): void {
  app.get<{ Params: IdParams }>(
    '/projects/:id/config',
    { schema: { params } },
    async (req) => found(ctx.projects.config(req.params.id), req.params.id),
  );

  app.patch<{ Params: IdParams; Body: ProjectConfigPatch }>(
    '/projects/:id/config',
    { schema: patchSchema },
    async (req) => {
      const { id } = req.params;
      // An empty patch is a client bug, not a way to read the config back.
      requirePatch(req.body, 'setting');
      requireKnownPlugins(ctx.registry, 'language', req.body.languages);
      requireKnownPlugins(ctx.registry, 'git-metric', req.body.metrics);
      requireKnownPlugins(
        ctx.registry,
        'commit-convention',
        req.body.convention,
      );

      try {
        return found(ctx.projects.setConfig(id, req.body), id);
      } catch (err) {
        if (err instanceof InvalidConfigError) {
          throw httpError(400, err.message);
        }
        throw err;
      }
    },
  );
}

function found(config: ProjectConfig | undefined, id: string): ProjectConfig {
  if (!config) throw httpError(404, `No project "${id}".`);
  return config;
}
