import type { FastifyInstance } from 'fastify';
import {
  DENSITIES,
  InvalidSettingsError,
  THEME_MODES,
  type AppSettingsPatch,
} from '@strata/core';
import type { RouteContext } from './context.js';
import { httpError } from './http-error.js';
import { requirePatch } from './patch.js';

const provider = {
  type: 'object',
  required: ['id', 'name'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 48 },
    name: { type: 'string', minLength: 1, maxLength: 100 },
    enabled: { type: 'boolean' },
    accent: {
      type: ['string', 'null'],
      pattern: '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
    },
    binary: { type: ['string', 'null'], minLength: 1 },
    home: { type: ['string', 'null'], minLength: 1 },
    shadowHome: { type: ['string', 'null'], minLength: 1 },
    args: { type: 'array', items: { type: 'string' } },
    env: {
      type: 'object',
      propertyNames: { pattern: '^[A-Za-z_][A-Za-z0-9_]*$' },
      additionalProperties: { type: 'string' },
    },
    models: { type: 'array', items: { type: 'string' } },
  },
};

/** One object per settings screen, so a screen can PATCH only its own section. */
const section = (properties: Record<string, unknown>) => ({
  type: 'object',
  additionalProperties: false,
  properties,
});

const patchSchema = {
  body: section({
    appearance: section({
      theme: { enum: [...THEME_MODES] },
      density: { enum: [...DENSITIES] },
    }),
    engine: section({
      pluginsDir: { type: ['string', 'null'], minLength: 1 },
      thirdPartyPlugins: { type: 'boolean' },
      cache: { type: 'boolean' },
    }),
    gates: section({
      failOnNewCycles: { type: 'boolean' },
      hotspotRegression: { type: ['number', 'null'], minimum: 0 },
    }),
    ai: section({
      healthCheckInterval: { type: 'integer', minimum: 0 },
      providers: { type: 'array', items: provider },
    }),
  }),
};

/**
 * The app-wide *Settings* screens: appearance, the plugin and cache engine, the
 * CI gates, and the AI providers this workbench knows about. One scope up from
 * `/projects/:id/config` — nothing here belongs to a single repository.
 *
 * `PATCH` merges two levels deep: a section left out keeps everything it had, a
 * field left out inside a section keeps its value, and an array that is sent
 * replaces the stored one whole.
 *
 * Reading is not the same as taking effect. The cache toggle applies to the
 * next run; the plugins directory and the third-party switch are read when the
 * server starts, because that is when plugins load; appearance, the gates and
 * the providers are stored for the shell, headless CI mode and the provider
 * work still to come.
 */
export function settingsRoute(app: FastifyInstance, ctx: RouteContext): void {
  app.get('/settings', async () => ctx.settings.get());

  app.patch<{ Body: AppSettingsPatch }>(
    '/settings',
    { schema: patchSchema },
    async (req) => {
      // An empty patch is a client bug, not a way to read the settings back —
      // and `{"appearance": {}}` names a screen and changes nothing on it.
      requirePatch(req.body, 'setting');
      for (const [name, fields] of Object.entries(req.body)) {
        if (Object.keys(fields).length === 0) {
          throw httpError(400, `Name at least one ${name} setting to change.`);
        }
      }

      try {
        return ctx.settings.patch(req.body);
      } catch (err) {
        if (err instanceof InvalidSettingsError) {
          throw httpError(400, err.message);
        }
        throw err;
      }
    },
  );
}
