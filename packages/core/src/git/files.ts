import type { RepoFile } from '@strata/sdk';
import { git } from './exec.js';

/** List files tracked at `rev`, each with its blob sha for cache keying. */
export async function listFiles(root: string, rev: string): Promise<RepoFile[]> {
  // `ls-tree -r` gives "<mode> blob <sha>\t<path>" lines.
  const out = await git(root, ['ls-tree', '-r', rev]);
  const files: RepoFile[] = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    const [meta, path] = line.split('\t');
    const parts = meta!.split(/\s+/);
    if (parts[1] !== 'blob') continue; // skip submodules/trees
    const blob = parts[2]!;
    files.push({
      path: path!,
      blob,
      read: async () => git(root, ['cat-file', '-p', blob]),
    });
  }
  return files;
}
