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

  app.post<{ Body: { root: string; rev?: string; historyLimit?: number } }>(
    '/analyze',
    async (req, reply) => {
      const { root, rev, historyLimit } = req.body ?? {};
      if (!root) return reply.status(400).send({ error: 'root is required' });
      return strata.analyze({ root, rev, historyLimit });
    },
  );

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
