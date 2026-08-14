import type { RepoContext, RepoFile } from '@strata/sdk';
import { describe, expect, it, vi } from 'vitest';
import plugin from './index.js';

/**
 * A repository as the core hands it over: `ctx.files` is already filtered to
 * the extensions this plugin claims, so a package.json only ever arrives
 * through `ctx.git` — which is exactly what the fake below mimics.
 */
function context(sources: Record<string, string>, tracked: Record<string, string> = {}): RepoContext {
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

describe('typescript plugin', () => {
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

    const { deadCode } = await plugin.analyze(ctx);

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

    const { graph, deadCode } = await plugin.analyze(ctx);

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

    const { graph, deadCode } = await plugin.analyze(ctx);

    expect(graph.edges).toEqual([
      { from: 'src/main.ts', to: 'src/user.ts', kind: 'import' },
      { from: 'src/main.ts', to: 'src/panel.ts', kind: 'import' },
    ]);
    // Both files are reached and consumed whole, so nothing is dead.
    expect(deadCode).toEqual([]);
  });

  it('says nothing about exports when no entry point can be found', async () => {
    const ctx = context({
      'src/a.ts': 'export const a = 1;',
      'src/b.ts': 'export const b = 2;',
    });

    expect((await plugin.analyze(ctx)).deadCode).toEqual([]);
  });

  it('keeps working when git cannot be reached', async () => {
    const ctx = context({ 'src/a.ts': 'export const a = 1;' });
    ctx.git = vi.fn(async () => {
      throw new Error('not a repository');
    });

    await expect(plugin.analyze(ctx)).resolves.toMatchObject({ deadCode: [] });
    expect(ctx.log.warn).toHaveBeenCalled();
  });
});
