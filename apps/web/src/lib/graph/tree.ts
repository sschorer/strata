/**
 * The folder tree the graph is drawn and browsed as.
 *
 * A repository is a tree, not a flat list of modules: `plugins/git-coupling`
 * lives *in* `plugins`, and a reader who closes `plugins` expects the whole
 * subtree to fold with it. So grouping is a real tree, built from the paths
 * themselves, and both the canvas and the side panel walk the same one.
 *
 * Chains are compressed on the way out. `plugins/git-coupling/src` holds one
 * folder and no files of its own, and drawing a ring inside a ring inside a
 * ring says nothing — so a folder with a single child and nothing else merges
 * into it, exactly as a file browser shows `a/b/c` on one line.
 */

export interface TreeEntry {
  /** The node drawn: a file, or a folder that is currently closed. */
  id: string;
  /** The folder it sits in — `''` for the repository root. */
  container: string;
  /** How many files it stands for; a closed folder stands for many. */
  weight: number;
}

export interface FolderNode {
  /** Full path, `''` for the root. */
  path: string;
  /** What the label shows — the segments this folder swallowed, joined. */
  name: string;
  folders: FolderNode[];
  /** Nodes drawn directly in this folder. */
  leaves: string[];
  /** Files anywhere below, for sizing the disc. */
  size: number;
}

/**
 * Where the packages the repository does *not* contain are collected. They
 * have no path of their own, and left at the root they scatter across the
 * drawing; gathered into one folder they close like any other.
 */
export const EXTERNAL = 'node_modules';

/** The folder a path sits in: `a/b/c.ts` → `a/b`, a root file → `''`. */
export function containerOf(path: string): string {
  const cut = path.lastIndexOf('/');
  return cut === -1 ? '' : path.slice(0, cut);
}

/** Every folder above a path, shallowest first. */
export function ancestorsOf(path: string): string[] {
  const segments = containerOf(path).split('/').filter(Boolean);
  return segments.map((_, index) => segments.slice(0, index + 1).join('/'));
}

/** Build the tree, then compress the chains that say nothing. */
export function folderTree(entries: readonly TreeEntry[]): FolderNode {
  const root = emptyFolder('');

  for (const entry of entries) {
    let folder = root;
    for (const path of ancestorsOf(`${entry.container}/x`)) {
      folder.size += entry.weight;
      folder = childFolder(folder, path);
    }
    folder.size += entry.weight;
    folder.leaves.push(entry.id);
  }

  sort(root);
  return compress(root);
}

function emptyFolder(path: string): FolderNode {
  const cut = path.lastIndexOf('/');
  return {
    path,
    name: cut === -1 ? path : path.slice(cut + 1),
    folders: [],
    leaves: [],
    size: 0,
  };
}

function childFolder(parent: FolderNode, path: string): FolderNode {
  const existing = parent.folders.find((folder) => folder.path === path);
  if (existing) return existing;

  const child = emptyFolder(path);
  parent.folders.push(child);
  return child;
}

function sort(folder: FolderNode): void {
  folder.folders.sort((a, b) => b.size - a.size || a.path.localeCompare(b.path));
  folder.leaves.sort();
  for (const child of folder.folders) sort(child);
}

/**
 * Fold a folder that holds one folder and nothing else into its child, so the
 * label reads `git-coupling/src` and the drawing gains a ring rather than
 * three. The root keeps its own level whatever it holds.
 */
function compress(folder: FolderNode): FolderNode {
  const folders = folder.folders.map(compress);

  if (folder.path !== '' && folders.length === 1 && folder.leaves.length === 0) {
    const only = folders[0]!;
    return { ...only, name: `${folder.name}/${only.name}` };
  }

  return { ...folder, folders };
}

/** Walk the tree, shallowest first. */
export function everyFolder(folder: FolderNode): FolderNode[] {
  return [folder, ...folder.folders.flatMap(everyFolder)];
}
