import type { RepoFile, StageContext } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import plugin from './index.js';

/**
 * A stage context as the core builds one: `ctx.files` is already narrowed to
 * what the manifest's filter matched, so a package.json only ever arrives
 * through `ctx.git` — which is exactly what the fake below mimics. Nothing
 * upstream produces anything this stage consumes, and it is handed no history,
 * because it declared it consumes neither.
 */
function context(
  sources: Record<string, string>,
  tracked: Record<string, string> = {},
): StageContext {
  const files: RepoFile[] = Object.entries(sources).map(([path, text]) => ({
    path,
    blob: path,
    read: async () => text,
  }));
  const all = { ...sources, ...tracked };

  return {
    root: '/repo',
    rev: 'deadbeef',
    files,
    git: vi.fn(async (args: string[]) => {
      if (args[0] === 'ls-tree') return Object.keys(all).join('\0');
      if (args[0] === 'show') return all[args[1]!.replace('deadbeef:', '')] ?? '';
      return '';
    }),
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    cache: { file: (file, compute) => compute(file) },
    inputs: {
      graph: {},
      metrics: {},
      findings: {},
      commits: {},
      aggregate: {},
    },
    history: [],
  };
}

const PACKAGE = JSON.stringify(
  {
    name: 'demo',
    main: './dist/index.js',
    dependencies: { used: '^1.0.0', unused: '^1.0.0' },
  },
  null,
  2,
);

describe('typescript stage', () => {
  it('finds all three shapes of dead code', async () => {
    const ctx = context(
      {
        'src/index.ts': [
          `import { greet } from './greet.js';`,
          `import 'used';`,
          'export function main() { return greet(); }',
        ].join('\n'),
        'src/greet.ts': [
          'export function greet() { return "hi"; }',
          'export function shout() { return "HI"; }',
        ].join('\n'),
        'src/orphan.ts': 'export const nobody = 1;',
      },
      { 'package.json': PACKAGE },
    );

    const { deadCode } = await plugin.run(ctx);

    expect(deadCode).toEqual([
      { path: 'package.json', symbol: 'unused', line: 6, reason: 'unused-dependency' },
      {
        path: 'src/greet.ts',
        symbol: 'shout',
        line: 2,
        reason: 'unreferenced-export',
      },
      // Reported once, whole — not once per export it happens to declare.
      { path: 'src/orphan.ts', reason: 'unreachable-file' },
    ]);
  });

  it('resolves a NodeNext specifier onto the TypeScript source it names', async () => {
    const ctx = context(
      {
        'src/index.ts': `export { helper } from './helper.js';`,
        'src/helper.ts': 'export const helper = 1;',
      },
      { 'package.json': '{ "name": "demo", "main": "./dist/index.js" }' },
    );

    const { graph, deadCode } = await plugin.run(ctx);

    expect(graph.edges).toEqual([
      { from: 'src/index.ts', to: 'src/helper.ts', kind: 'import' },
    ]);
    // The entry re-exports it, so it is public API rather than dead.
    expect(deadCode).toEqual([]);
  });

  it('follows a path alias and a lazy import', async () => {
    const ctx = context(
      {
        'src/main.ts': [
          `import { user } from '@app/user.js';`,
          `export const open = () => import('./panel.js');`,
        ].join('\n'),
        'src/user.ts': 'export const user = 1;',
        'src/panel.ts': 'export const panel = 2;',
      },
      {
        'package.json': '{ "name": "demo", "main": "./dist/main.js" }',
        'tsconfig.json': JSON.stringify({
          compilerOptions: { paths: { '@app/*': ['src/*'] } },
        }),
      },
    );

    const { graph, deadCode } = await plugin.run(ctx);

    expect(graph.edges).toEqual([
      { from: 'src/main.ts', to: 'src/user.ts', kind: 'import' },
      { from: 'src/main.ts', to: 'src/panel.ts', kind: 'import' },
    ]);
    // Both files are reached and consumed whole, so nothing is dead.
    expect(deadCode).toEqual([]);
  });

  it('summarises the graph it just built', async () => {
    const ctx = context(
      {
        'src/index.ts': [
          `import { a } from './a.js';`,
          `import { b } from './b.js';`,
          'export const main = () => a + b;',
        ].join('\n'),
        'src/a.ts': [
          `import { shared } from './shared.js';`,
          'export const a = shared;',
        ].join('\n'),
        'src/b.ts': [
          `import { shared } from './shared.js';`,
          'export const b = shared;',
        ].join('\n'),
        'src/shared.ts': 'export const shared = 1;',
      },
      { 'package.json': '{ "name": "demo", "main": "./dist/index.js" }' },
    );

    const { summary } = await plugin.run(ctx);

    expect(summary).toEqual({
      nodes: 4,
      edges: 4,
      cycles: 0,
      cycleNodes: 0,
      maxFanIn: { id: 'src/shared.ts', count: 2 },
      maxFanOut: { id: 'src/index.ts', count: 2 },
    });
  });

  it('counts the files a cycle holds', async () => {
    const ctx = context({
      'src/a.ts': [
        `import { b } from './b.js';`,
        'export const a = () => b();',
      ].join('\n'),
      'src/b.ts': [
        `import { a } from './a.js';`,
        'export const b = () => a();',
      ].join('\n'),
    });

    const { summary } = await plugin.run(ctx);

    expect(summary.cycles).toBe(1);
    expect(summary.cycleNodes).toBe(2);
  });

  it('says nothing about exports when no entry point can be found', async () => {
    const ctx = context({
      'src/a.ts': 'export const a = 1;',
      'src/b.ts': 'export const b = 2;',
    });

    expect((await plugin.run(ctx)).deadCode).toEqual([]);
  });

  it('keeps working when git cannot be reached', async () => {
    const ctx = context({ 'src/a.ts': 'export const a = 1;' });
    ctx.git = vi.fn(async () => {
      throw new Error('not a repository');
    });

    await expect(plugin.run(ctx)).resolves.toMatchObject({ deadCode: [] });
    expect(ctx.log.warn).toHaveBeenCalled();
  });
});
