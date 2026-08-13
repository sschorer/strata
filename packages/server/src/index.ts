import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import Fastify from 'fastify';
import { PluginRegistry, Strata } from '@strata/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

/**
 * Discover and load the first-party plugins that ship in this repo. In a real
 * deployment this also scans a user plugins directory (see docs/PLUGINS.md).
 */
async function buildRegistry(): Promise<PluginRegistry> {
  const registry = new PluginRegistry();
  const builtins = [
    'plugins/commit-conventional/strata.plugin.json',
    'plugins/git-hotspots/strata.plugin.json',
    'plugins/language-typescript/strata.plugin.json',
  ];
  for (const rel of builtins) {
    try {
      await registry.loadFrom(resolve(REPO_ROOT, rel));
    } catch (err) {
      console.warn(`skip plugin ${rel}:`, (err as Error).message);
    }
  }
  return registry;
}

export async function createServer() {
  const app = Fastify({ logger: true });
  const registry = await buildRegistry();
  const strata = new Strata(registry);

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/plugins', async () =>
    registry.all().map((l) => l.manifest),
  );

  // The schema rejects wrong types outright — `"cache": "false"` is a string,
  // and silently caching anyway would be worse than a 400.
  const analyzeSchema = {
    body: {
      type: 'object',
      required: ['root'],
      additionalProperties: false,
      properties: {
        root: { type: 'string', minLength: 1 },
        rev: { type: 'string' },
        historyLimit: { type: 'integer', minimum: 1 },
        cache: { type: 'boolean' },
      },
    },
  };

  app.post<{
    Body: { root: string; rev?: string; historyLimit?: number; cache?: boolean };
  }>('/analyze', { schema: analyzeSchema }, async (req) => {
    const { root, rev, historyLimit, cache } = req.body;
    return strata.analyze({ root, rev, historyLimit, cache });
  });

  // Escape hatch: drop every cached result (e.g. after upgrading a plugin
  // in place without bumping its version).
  app.delete('/cache', async () => {
    strata.clearCache();
    return { cleared: true };
  });

  // Flush and close the cache with the server.
  app.addHook('onClose', async () => strata.close());

  return app;
}

// Entry point when run directly (node dist/index.js).
if (process.argv[1] && import.meta.url === pathToUrl(process.argv[1])) {
  const port = Number(process.env.PORT ?? 4000);
  const app = await createServer();
  await app.listen({ port, host: '0.0.0.0' });
}

function pathToUrl(p: string): string {
  return new URL(`file://${resolve(p)}`).href;
}
