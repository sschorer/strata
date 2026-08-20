// The files `new-plugin.mjs` writes, one template per plugin kind.

/** Per-kind `define*` helper and a stub body for src/index.ts. */
export const KINDS = {
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
};

export function entryModule({ helper, body }) {
  return `import { ${helper} } from '@strata/sdk';\n\nexport default ${helper}({\n${body}\n});\n`;
}

export function pluginManifest(name, kind) {
  return {
    id: `strata-${name}`,
    name,
    kind,
    version: '0.1.0',
    sdk: '0.1.0',
    main: './dist/index.js',
    description: 'TODO',
    author: 'Strata',
  };
}

export function packageJson(name) {
  return {
    name: `@strata/plugin-${name}`,
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
    devDependencies: {
      '@types/node': '^24.13.3',
      typescript: '^7.0.2',
    },
  };
}

export function tsconfig() {
  return {
    extends: '../../tsconfig.base.json',
    compilerOptions: { rootDir: 'src', outDir: 'dist' },
    include: ['src'],
  };
}
