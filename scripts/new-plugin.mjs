#!/usr/bin/env node
// Scaffold a new plugin from a template.
//   node scripts/new-plugin.mjs <name> <kind>
// kind ∈ language | commit-convention | git-metric | ai-provider
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = {
  language: {
    helper: 'defineLanguagePlugin',
    body: `  extensions: ['CHANGE_ME'],\n  async analyze(ctx) {\n    return { graph: { nodes: [], edges: [], cycles: [] }, deadCode: [], metrics: [] };\n  },`,
  },
  'commit-convention': {
    helper: 'defineCommitConventionPlugin',
    body: `  convention: 'CHANGE_ME',\n  parse(commit) {\n    return { type: null, scope: null, breaking: false, subject: commit.message.split('\\n')[0], tags: {}, valid: false };\n  },`,
  },
  'git-metric': {
    helper: 'defineGitMetricPlugin',
    body: `  id: 'CHANGE_ME',\n  async compute(ctx, history) {\n    return { id: 'CHANGE_ME', label: 'CHANGE_ME', points: [] };\n  },`,
  },
  'ai-provider': {
    helper: 'defineAIProvider',
    body: `  id: 'CHANGE_ME',\n  async listModels() { return []; },\n  async chat(messages, opts) { throw new Error('not implemented'); },`,
  },
};

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const name = process.argv[2];
const kind = process.argv[3];

if (!name || !KINDS[kind]) {
  console.error(
    `usage: new-plugin <name> <kind>\n  kind ∈ ${Object.keys(KINDS).join(' | ')}`,
  );
  process.exit(1);
}

const dir = resolve(root, 'plugins', name);
const { helper, body } = KINDS[kind];
const pkg = `@strata/plugin-${name}`;
const id = `strata-${name}`;

await mkdir(resolve(dir, 'src'), { recursive: true });

await writeFile(
  resolve(dir, 'src/index.ts'),
  `import { ${helper} } from '@strata/sdk';\n\nexport default ${helper}({\n${body}\n});\n`,
);

await writeFile(
  resolve(dir, 'strata.plugin.json'),
  JSON.stringify(
    { id, name, kind, version: '0.1.0', sdk: '0.1.0', main: './dist/index.js', description: 'TODO', author: 'Strata' },
    null,
    2,
  ) + '\n',
);

await writeFile(
  resolve(dir, 'package.json'),
  JSON.stringify(
    {
      name: pkg,
      version: '0.1.0',
      license: 'Apache-2.0',
      type: 'module',
      main: './dist/index.js',
      files: ['dist', 'strata.plugin.json'],
      scripts: {
        build: 'tsc -p tsconfig.json',
        typecheck: 'tsc -p tsconfig.json --noEmit',
      },
      dependencies: { '@strata/sdk': 'workspace:*' },
      devDependencies: { typescript: '^5.6.3' },
    },
    null,
    2,
  ) + '\n',
);

await writeFile(
  resolve(dir, 'tsconfig.json'),
  JSON.stringify(
    { extends: '../../tsconfig.base.json', compilerOptions: { rootDir: 'src', outDir: 'dist' }, include: ['src'] },
    null,
    2,
  ) + '\n',
);

console.log(`Created plugins/${name} (${kind}). Next:`);
console.log('  1. pnpm install   # link the new workspace package');
console.log(`  2. edit plugins/${name}/src/index.ts (replace CHANGE_ME)`);
console.log('  3. register it in packages/server (buildRegistry) if first-party');
console.log('  4. add a docs ARCHITECTURE.md (see docs/PLUGINS.md)');
