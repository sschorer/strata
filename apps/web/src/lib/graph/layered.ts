import type { GraphEdge, GraphNode } from '@strata/sdk';
import { laneTree, type Lane } from './lanes';
import { rankNodes } from './rank';
import { containerOf } from './tree';
import type { Point } from './viewport';

export interface Box {
  /** Top-left corner. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A folder standing open: the dashed container drawn around its cards. */
export interface LaidOutGroup extends Box {
  path: string;
  name: string;
  /** How deep it is nested; a folder at the top level is 1. */
  depth: number;
  /** Cards below it, its open sub-folders included. */
  size: number;
}

export interface LayeredLayout {
  /** Top-left of each card. */
  cards: Map<string, Box>;
  /** Centre of each card, which is where its arrows meet it. */
  points: Map<string, Point>;
  groups: LaidOutGroup[];
  /** Edges the ranking turned around; they are drawn pointing back. */
  reversed: Set<string>;
  /** The whole drawing. Bigger than the canvas when it has to be. */
  world: { width: number; height: number };
}

export interface LayeredOptions {
  /** A card is one size for everything, so every name stays readable. */
  card?: { width: number; height: number };
  /** The folders standing open, each of which gets a container. */
  open?: ReadonlySet<string>;
  /** Name to print on a container. */
  labelOf?: (path: string) => string;
}

const CARD = { width: 176, height: 44 };

/** Space between two ranks, and between two things inside one rank. */
const RANK_GAP = 54;
const SIBLING_GAP = 24;

/** Room a container keeps around its contents, and above them for its name. */
const GROUP_PAD = 14;
const GROUP_HEAD = 26;

/** Space around the whole drawing. */
const MARGIN = 26;

/**
 * How wide one rank may run before it wraps onto another row.
 *
 * Everything nothing depends on lands in the first rank; left alone that is a
 * single line stretching off the side of the drawing. Wrapping turns it into a
 * block, which keeps the picture a shape rather than a ribbon.
 */
const MAX_IN_RANK = 6;

/** How many times to sweep the ranks, settling each against its neighbours. */
const SWEEPS = 6;

interface LaidLane {
  width: number;
  height: number;
  cards: Map<string, Box>;
  groups: LaidOutGroup[];
}

/**
 * Lay the graph out in ranks that run top to bottom, the way Nx draws a
 * project graph.
 *
 * Every card is **the same size**, because the moment a node is sized by what
 * it contains, a folder with forty files in it gets drawn four pixels wide and
 * the picture stops being usable. Uniform cards mean a name is always legible
 * and two cards can always be told apart.
 *
 * The layout is **recursive**, and that is what keeps an open folder in one
 * piece. Each folder is laid out on its own — its contents ranked against each
 * other, with the imports between them lifted to that level — and the result
 * then takes part in its parent's layout as a *single* box of that size. So a
 * container occupies one place in the flow rather than stretching across every
 * rank of the whole graph, and a folder opened inside another sits inside it.
 *
 * Cards are placed on a grid, so two of them cannot overlap; containers are
 * placed as units, so two of those cannot either. The drawing grows to
 * whatever this needs, and the viewport pans and zooms over it.
 */
export function layeredLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  options: LayeredOptions = {},
): LayeredLayout {
  const {
    card = CARD,
    open = new Set<string>(),
    labelOf = (path) => path,
  } = options;
  if (nodes.length === 0) {
    return {
      cards: new Map(),
      points: new Map(),
      groups: [],
      reversed: new Set(),
      world: { width: 0, height: 0 },
    };
  }

  const ids = nodes.map((node) => node.id);
  /** The deepest open folder holding a card. */
  const folderOf = (id: string) => {
    let folder = containerOf(id);
    while (folder !== '' && !open.has(folder)) folder = containerOf(folder);
    return folder;
  };
  const root = laneTree(ids, open, containerOf, folderOf);
  const reversed = new Set<string>();

  /**
   * The imports between one folder's children, each end mapped onto the child
   * that holds it. What stays inside a single child is that child's own
   * business, and is ranked when that child is laid out.
   */
  const lift = (lane: Lane, children: ReadonlySet<string>): GraphEdge[] => {
    const owner = new Map<string, string>();
    for (const id of lane.own) owner.set(id, id);
    for (const child of lane.children) {
      for (const id of everyCardOf(child)) owner.set(id, child.path);
    }

    const lifted = new Map<string, GraphEdge>();
    for (const edge of edges) {
      const from = owner.get(edge.from);
      const to = owner.get(edge.to);
      if (!from || !to || from === to) continue;
      if (!children.has(from) || !children.has(to)) continue;
      lifted.set(`${from} ${to}`, { from, to, kind: edge.kind });
    }
    return [...lifted.values()];
  };

  /**
   * Lay one folder out in its own coordinates, starting at the origin, and
   * report how much room it took. Its open sub-folders are laid out first, so
   * each is a box of known size by the time this folder places them.
   */
  const layoutLane = (lane: Lane, depth: number): LaidLane => {
    const cards = new Map<string, Box>();
    const groups: LaidOutGroup[] = [];
    const sizes = new Map<string, { width: number; height: number }>();
    const inside = new Map<string, LaidLane>();

    for (const id of lane.own) sizes.set(id, { ...card });
    for (const child of lane.children) {
      const laid = layoutLane(child, depth + 1);
      sizes.set(child.path, { width: laid.width, height: laid.height });
      inside.set(child.path, laid);
    }

    const children = [...sizes.keys()];
    if (children.length === 0) {
      return { width: card.width, height: card.height, cards, groups };
    }

    const links = lift(lane, new Set(children));
    const ranked = rankNodes(children, links);
    for (const edge of ranked.reversed) reversed.add(edge);
    const ranks = Math.max(...ranked.rank.values()) + 1;
    const order = settle(children, links, ranked.rank, ranks);

    // Ranks run down the page; what sits in one runs across it, wrapping so a
    // crowded rank becomes a block rather than a line off the side.
    let y = 0;
    let width = 0;
    for (let index = 0; index < ranks; index += 1) {
      const here = children
        .filter((id) => ranked.rank.get(id) === index)
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));

      for (let start = 0; start < here.length; start += MAX_IN_RANK) {
        const row = here.slice(start, start + MAX_IN_RANK);
        const tall = Math.max(...row.map((id) => sizes.get(id)!.height));
        let x = 0;

        for (const id of row) {
          const size = sizes.get(id)!;
          const box = {
            x,
            y: y + (tall - size.height) / 2,
            width: size.width,
            height: size.height,
          };
          const laid = inside.get(id);

          if (!laid) cards.set(id, box);
          else {
            for (const [held, at] of laid.cards) {
              cards.set(held, { ...at, x: at.x + box.x, y: at.y + box.y });
            }
            for (const group of laid.groups) {
              groups.push({ ...group, x: group.x + box.x, y: group.y + box.y });
            }
            const child = lane.children.find((one) => one.path === id)!;
            groups.push({
              ...box,
              path: child.path,
              name: labelOf(child.path),
              depth,
              size: countOf(child),
            });
          }

          x += size.width + SIBLING_GAP;
        }

        width = Math.max(width, x - SIBLING_GAP);
        y += tall + RANK_GAP;
      }
    }

    const height = y - RANK_GAP;
    if (lane.path === '') return { width, height, cards, groups };

    // Inside a container, everything clears the padding and the name on top.
    const move = <T extends Box>(box: T): T => ({
      ...box,
      x: box.x + GROUP_PAD,
      y: box.y + GROUP_HEAD,
    });
    return {
      width: width + 2 * GROUP_PAD,
      height: height + GROUP_HEAD + GROUP_PAD,
      cards: new Map([...cards].map(([id, box]) => [id, move(box)])),
      groups: groups.map(move),
    };
  };

  const laid = layoutLane(root, 1);
  const shift = <T extends Box>(box: T): T => ({
    ...box,
    x: box.x + MARGIN,
    y: box.y + MARGIN,
  });
  const cards = new Map([...laid.cards].map(([id, box]) => [id, shift(box)]));

  return {
    cards,
    points: new Map(
      [...cards].map(([id, box]) => [
        id,
        { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      ]),
    ),
    groups: laid.groups.map(shift),
    reversed,
    world: {
      width: laid.width + 2 * MARGIN,
      height: laid.height + 2 * MARGIN,
    },
  };
}

const everyCardOf = (lane: Lane): string[] => [
  ...lane.own,
  ...lane.children.flatMap(everyCardOf),
];

const countOf = (lane: Lane): number => everyCardOf(lane).length;

/**
 * Order what sits in each rank by the average position of everything it
 * connects to, sweeping until it settles. Fewer crossings is the whole point:
 * a graph whose arrows braid is unreadable however tidy its boxes are.
 */
function settle(
  ids: readonly string[],
  edges: readonly GraphEdge[],
  rank: ReadonlyMap<string, number>,
  ranks: number,
): Map<string, number> {
  const order = new Map<string, number>();
  [...ids].sort().forEach((id, index) => order.set(id, index));

  const neighbours = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of edges) {
    neighbours.get(edge.from)?.push(edge.to);
    neighbours.get(edge.to)?.push(edge.from);
  }

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    for (let index = 0; index < ranks; index += 1) {
      ids
        .filter((id) => rank.get(id) === index)
        .map((id) => {
          const around = (neighbours.get(id) ?? []).filter(
            (other) => rank.get(other) !== index,
          );
          const mean = around.length
            ? around.reduce((sum, other) => sum + (order.get(other) ?? 0), 0) /
              around.length
            : (order.get(id) ?? 0);
          return { id, mean };
        })
        .sort((a, b) => a.mean - b.mean || a.id.localeCompare(b.id))
        .forEach((entry, position) => order.set(entry.id, position));
    }
  }

  return order;
}
