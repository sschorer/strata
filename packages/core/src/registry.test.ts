import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger, PluginKind } from '@strata/sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginRegistry } from './registry.js';

/**
 * Third-party plugin discovery: a user plugins directory is scanned the same
 * way built-ins are, but nothing in it is trusted — a broken, hostile or
 * clashing plugin must cost only itself.
 */

const silent: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

let dir: string;

/** The recorded skip reasons — asserting on these also pins their count. */
function errors(registry: PluginRegistry): string[] {
  return registry.failures().map((f) => f.error);
}

const PLUGIN_SOURCE = (kind: PluginKind) => `export default {
  kind: ${JSON.stringify(kind)},
  extensions: ['ts'],
  convention: 'test',
  id: 'test',
  async analyze() { return { graph: { nodes: [], edges: [], cycles: [] }, deadCode: [], metrics: [] }; },
  async compute() { return { id: 'test', label: 'Test', points: [] }; },
  parse() { return { type: 'feat', breaking: false, subject: '', tags: [], valid: true }; },
};
`;

/** Write a plugin directory; `manifest` overrides merge into a valid manifest. */
function writePlugin(
  name: string,
  overrides: Record<string, unknown> = {},
  kind: PluginKind = 'language',
): string {
  const pluginDir = join(dir, name);
  mkdirSync(pluginDir, { recursive: true });
  writeFileSync(join(pluginDir, 'index.js'), PLUGIN_SOURCE(kind));
  writeFileSync(
    join(pluginDir, 'strata.plugin.json'),
    JSON.stringify({
      id: `strata-${name}`,
      name,
      kind,
      version: '0.1.0',
      sdk: '0.1.0',
      main: './index.js',
      ...overrides,
    }),
  );
  return pluginDir;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'strata-plugins-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('loadDirectory', () => {
  it('loads every installed plugin, tagged as third-party', async () => {
    writePlugin('alpha');
    writePlugin('beta', {}, 'git-metric');

    const registry = new PluginRegistry(silent);
    const loaded = await registry.loadDirectory(dir);

    expect(loaded.map((l) => l.manifest.id)).toEqual([
      'strata-alpha',
      'strata-beta',
    ]);
    expect(loaded.every((l) => l.source === 'user')).toBe(true);
    expect(registry.byKind('language')).toHaveLength(1);
    expect(registry.byKind('git-metric')).toHaveLength(1);
    expect(registry.failures()).toEqual([]);
  });

  it('ignores directories without a manifest', async () => {
    writePlugin('alpha');
    mkdirSync(join(dir, 'node_modules', 'left-over'), { recursive: true });
    writeFileSync(join(dir, 'README.md'), '# not a plugin');

    const registry = new PluginRegistry(silent);
    const loaded = await registry.loadDirectory(dir);

    expect(loaded).toHaveLength(1);
    expect(registry.failures()).toEqual([]);
  });

  it('follows a symlinked plugin directory', async () => {
    const source = writePlugin('alpha');
    const other = mkdtempSync(join(tmpdir(), 'strata-link-'));
    try {
      symlinkSync(source, join(other, 'linked'), 'dir');
      const registry = new PluginRegistry(silent);
      expect(await registry.loadDirectory(other)).toHaveLength(1);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('treats a missing directory as no plugins installed', async () => {
    const registry = new PluginRegistry(silent);

    expect(await registry.loadDirectory(join(dir, 'nope'))).toEqual([]);
    expect(registry.failures()).toEqual([]);
  });

  it('keeps loading after a broken plugin, and records why it was skipped', async () => {
    writePlugin('broken', { sdk: '9.0.0' });
    writePlugin('good');

    const registry = new PluginRegistry(silent);
    const loaded = await registry.loadDirectory(dir);

    expect(loaded.map((l) => l.manifest.id)).toEqual(['strata-good']);
    expect(registry.failures()).toEqual([
      {
        manifestPath: join(dir, 'broken', 'strata.plugin.json'),
        source: 'user',
        error: expect.stringMatching(/targets SDK 9\.0\.0/),
      },
    ]);
  });
});

describe('rejected plugins', () => {
  it('rejects a manifest missing a required field', async () => {
    writePlugin('alpha', { main: undefined });

    const registry = new PluginRegistry(silent);
    await registry.loadDirectory(dir);

    expect(errors(registry)).toEqual([
      expect.stringMatching(/missing a "main" string/),
    ]);
  });

  it('rejects an unknown kind', async () => {
    writePlugin('alpha', { kind: 'wat' });

    const registry = new PluginRegistry(silent);
    await registry.loadDirectory(dir);

    expect(errors(registry)).toEqual([
      expect.stringMatching(/unknown kind "wat"/),
    ]);
  });

  it('rejects a "main" pointing outside the plugin directory', async () => {
    writePlugin('alpha', { main: '../escape.js' });
    writeFileSync(join(dir, 'escape.js'), 'export default { kind: "language" };');

    const registry = new PluginRegistry(silent);
    await registry.loadDirectory(dir);

    expect(registry.all()).toEqual([]);
    expect(errors(registry)).toEqual([
      expect.stringMatching(/outside its own directory/),
    ]);
  });

  it('rejects a module whose exported kind contradicts its manifest', async () => {
    const pluginDir = writePlugin('alpha');
    writeFileSync(join(pluginDir, 'index.js'), PLUGIN_SOURCE('ai-provider'));

    const registry = new PluginRegistry(silent);
    await registry.loadDirectory(dir);

    expect(errors(registry)).toEqual([
      expect.stringMatching(
        /declared as kind "language" but exports kind "ai-provider"/,
      ),
    ]);
  });

  it('rejects a module with no default export', async () => {
    const pluginDir = writePlugin('alpha');
    writeFileSync(join(pluginDir, 'index.js'), 'export const nope = 1;');

    const registry = new PluginRegistry(silent);
    await registry.loadDirectory(dir);

    expect(errors(registry)).toEqual([
      expect.stringMatching(/must default-export/),
    ]);
  });

  it('refuses to let a third-party plugin shadow a loaded id', async () => {
    writePlugin('alpha');
    writePlugin('copycat', { id: 'strata-alpha' });

    const registry = new PluginRegistry(silent);
    const loaded = await registry.loadDirectory(dir);

    expect(loaded.map((l) => l.manifestPath)).toEqual([
      join(dir, 'alpha', 'strata.plugin.json'),
    ]);
    expect(errors(registry)).toEqual([
      expect.stringMatching(/already loaded from/),
    ]);
  });
});

describe('loadFrom', () => {
  it('throws rather than recording, so a built-in failure is not silent', async () => {
    const pluginDir = writePlugin('alpha', { sdk: '9.0.0' });

    const registry = new PluginRegistry(silent);
    await expect(
      registry.loadFrom(join(pluginDir, 'strata.plugin.json')),
    ).rejects.toThrow(/targets SDK 9\.0\.0/);
    expect(registry.failures()).toEqual([]);
  });

  it('defaults to the built-in source', async () => {
    const pluginDir = writePlugin('alpha');

    const registry = new PluginRegistry(silent);
    const loaded = await registry.loadFrom(
      join(pluginDir, 'strata.plugin.json'),
    );

    expect(loaded.source).toBe('builtin');
  });
});
