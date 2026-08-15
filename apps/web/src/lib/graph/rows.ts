import { type FolderNode } from './tree';

/** One line of the folder panel: a folder, at its depth in the tree. */
export interface FolderRow {
  path: string;
  name: string;
  /** 0 for a folder at the repository root. */
  depth: number;
  /** Files anywhere below it. */
  files: number;
  /** Whether anything below it sits in an import cycle. */
  knotted: boolean;
  open: boolean;
}

/**
 * Flatten the tree into the rows the panel lists.
 *
 * A closed folder's children are left out — that is what closed means, and a
 * flat list of rows with a depth is far easier to render, test and keyboard
 * through than a component that recurses into itself.
 */
export function folderRows(
  tree: FolderNode,
  collapsed: ReadonlySet<string>,
  cycleOf: ReadonlyMap<string, number>,
): FolderRow[] {
  const rows: FolderRow[] = [];

  const walk = (folder: FolderNode, depth: number): void => {
    for (const child of folder.folders) {
      const open = !collapsed.has(child.path);
      rows.push({
        path: child.path,
        name: child.name,
        depth,
        files: child.size,
        knotted: knotted(child, cycleOf),
        open,
      });
      if (open) walk(child, depth + 1);
    }
  };

  walk(tree, 0);
  return rows;
}

function knotted(
  folder: FolderNode,
  cycleOf: ReadonlyMap<string, number>,
): boolean {
  return (
    folder.leaves.some((id) => cycleOf.has(id)) ||
    folder.folders.some((child) => knotted(child, cycleOf))
  );
}
