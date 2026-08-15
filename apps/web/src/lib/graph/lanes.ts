/**
 * The nesting of the folders standing open.
 *
 * A folder opened *inside* an open folder belongs inside it — `packages/core`
 * is part of `packages`, and drawing its container somewhere else loses the
 * one thing the reader opened it to see. So the open folders form a tree, and
 * every card hangs off the deepest one that contains it.
 */
export interface Lane {
  /** Folder path; `''` is the drawing itself, which has no container. */
  path: string;
  /** Cards sitting directly in this lane, not in one of its children. */
  own: string[];
  children: Lane[];
}

/**
 * Build the lane tree from the folders that are open. `folderOf` answers, for
 * one card, the deepest open folder holding it — `''` when none does.
 */
export function laneTree(
  ids: readonly string[],
  open: ReadonlySet<string>,
  parentOf: (path: string) => string,
  folderOf: (id: string) => string,
): Lane {
  const root: Lane = { path: '', own: [], children: [] };
  const lanes = new Map<string, Lane>([['', root]]);

  /**
   * The nearest folder above this one that is also open. An open folder deep
   * inside a closed one still belongs to whatever *is* open around it, not to
   * the drawing.
   */
  const openParent = (path: string): string => {
    let above = parentOf(path);
    while (above !== '' && !open.has(above)) above = parentOf(above);
    return above;
  };

  /** Make a lane and everything above it, so a child never floats free. */
  const laneFor = (path: string): Lane => {
    const known = lanes.get(path);
    if (known) return known;

    const lane: Lane = { path, own: [], children: [] };
    lanes.set(path, lane);
    laneFor(openParent(path)).children.push(lane);
    return lane;
  };

  for (const path of [...open].sort()) laneFor(path);
  for (const id of ids) laneFor(folderOf(id)).own.push(id);

  sort(root);
  return root;
}

function sort(lane: Lane): void {
  lane.children.sort((a, b) => a.path.localeCompare(b.path));
  lane.own.sort();
  for (const child of lane.children) sort(child);
}

/** Every lane, outermost first. */
export function everyLane(lane: Lane): Lane[] {
  return [lane, ...lane.children.flatMap(everyLane)];
}
