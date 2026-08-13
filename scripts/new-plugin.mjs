#!/usr/bin/env node
// Scaffold a new plugin from a template.
//   node scripts/new-plugin.mjs <name> <kind>
// kind ∈ language | commit-convention | git-metric | ai-provider
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KINDS,
  entryModule,
  packageJson,
  pluginManifest,
  tsconfig,
} from './lib/templates.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];
const kind = process.argv[3];

if (!name || !KINDS[kind]) {
  console.error(
    `usage: new-plugin <name> <kind>\n  kind ∈ ${Object.keys(KINDS).join(' | ')}`,
  );
  process.exit(1);
}

const dir = resolve(root, 'plugins', name);
const json = (value) => JSON.stringify(value, null, 2) + '\n';

await mkdir(resolve(dir, 'src'), { recursive: true });
await writeFile(resolve(dir, 'src/index.ts'), entryModule(KINDS[kind]));
await writeFile(resolve(dir, 'strata.plugin.json'), json(pluginManifest(name, kind)));
await writeFile(resolve(dir, 'package.json'), json(packageJson(name)));
await writeFile(resolve(dir, 'tsconfig.json'), json(tsconfig()));

console.log(`Created plugins/${name} (${kind}). Next:`);
console.log('  1. pnpm install   # link the new workspace package');
console.log(`  2. edit plugins/${name}/src/index.ts (replace CHANGE_ME)`);
console.log('  3. register it in packages/server (buildRegistry) if first-party');
console.log('  4. add a docs ARCHITECTURE.md (see docs/PLUGINS.md)');
