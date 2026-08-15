import { describe, expect, it } from 'vitest';
import { ancestorsOf, containerOf, everyFolder, folderTree } from './tree';

const entries = (...paths: string[]) =>
  paths.map((id) => ({ id, container: containerOf(id), weight: 1 }));

describe('containerOf', () => {
  it('is the folder a path sits in', () => {
    expect(containerOf('packages/core/src/x.ts')).toBe('packages/core/src');
    expect(containerOf('README.md')).toBe('');
  });
});

describe('ancestorsOf', () => {
  it('lists every folder above a path, shallowest first', () => {
    expect(ancestorsOf('a/b/c/d.ts')).toEqual(['a', 'a/b', 'a/b/c']);
    expect(ancestorsOf('d.ts')).toEqual([]);
  });
});

describe('folderTree', () => {
  it('nests folders the way the repository does', () => {
    const tree = folderTree(
      entries('plugins/one/src/a.ts', 'plugins/two/src/b.ts'),
    );

    expect(tree.folders.map((folder) => folder.path)).toEqual(['plugins']);
    const plugins = tree.folders[0]!;
    expect(plugins.size).toBe(2);
    expect(plugins.folders.map((folder) => folder.path)).toEqual([
      'plugins/one/src',
      'plugins/two/src',
    ]);
  });

  it('compresses a chain that holds nothing of its own', () => {
    const tree = folderTree(entries('plugins/one/src/a.ts'));

    // Nothing branches until the file, so the whole chain reads as one level
    // — the way a file browser writes `a/b/c` on a single line.
    expect(tree.folders.map((folder) => folder.name)).toEqual([
      'plugins/one/src',
    ]);
    expect(tree.folders[0]!.path).toBe('plugins/one/src');
    expect(tree.folders[0]!.leaves).toEqual(['plugins/one/src/a.ts']);
  });

  it('keeps files that sit at the repository root', () => {
    const tree = folderTree(entries('README.md', 'src/a.ts'));

    expect(tree.leaves).toEqual(['README.md']);
    expect(tree.folders.map((folder) => folder.path)).toEqual(['src']);
  });

  it('weighs a folder by everything below it', () => {
    const tree = folderTree([
      { id: 'a/one.ts', container: 'a', weight: 1 },
      { id: 'a/b', container: 'a', weight: 12 },
    ]);

    expect(tree.folders[0]!.size).toBe(13);
  });

  it('walks every folder, biggest first', () => {
    const tree = folderTree(
      entries('big/1.ts', 'big/2.ts', 'big/3.ts', 'small/1.ts'),
    );

    expect(everyFolder(tree).map((folder) => folder.path)).toEqual([
      '',
      'big',
      'small',
    ]);
  });
});
