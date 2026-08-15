import type { GraphNode } from '@strata/sdk';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphOf } from '$lib/test/graph';
import { reactiveProps } from '$lib/test/props.svelte';
import { render } from '$lib/test/render';
import { cycleMembership, cycleViews } from './cycles';
import GraphCanvas from './GraphCanvas.svelte';

const graph = graphOf('a>b b>a b>c', [['a', 'b']]);
const cycleOf = cycleMembership(cycleViews(graph));
const props = { nodes: graph.nodes, edges: graph.edges, cycleOf };

/** Every node is a card; a folder's dashed container is not one. */
const cards = (container: HTMLElement) => [
  ...container.querySelectorAll('rect[role="button"][aria-label]'),
];
const cardFor = (container: HTMLElement, id: string) =>
  cards(container).find(
    (card) => card.getAttribute('aria-label') === id,
  ) as SVGRectElement;
const lines = (container: HTMLElement) => [
  ...container.querySelectorAll('line'),
];

let ui: ReturnType<typeof render>;

afterEach(() => ui?.destroy());

describe('GraphCanvas', () => {
  it('draws a card per node and a line per edge', () => {
    ui = render(GraphCanvas, props);

    expect(cards(ui.container)).toHaveLength(3);
    expect(lines(ui.container)).toHaveLength(3);
  });

  it('gives every card the same size, whatever it holds', () => {
    ui = render(GraphCanvas, {
      nodes: [
        { id: 'a.ts', label: 'a.ts', kind: 'file' as const },
        {
          id: 'big',
          label: 'big',
          kind: 'module' as const,
          meta: { files: 400 },
        },
      ],
      edges: [],
      cycleOf: new Map(),
    });

    const [one, other] = cards(ui.container);
    expect(one!.getAttribute('width')).toBe(other!.getAttribute('width'));
    expect(one!.getAttribute('height')).toBe(other!.getAttribute('height'));
  });

  it('paints the cycle, and only the cycle, in the danger colour', () => {
    ui = render(GraphCanvas, props);

    const knotted = cards(ui.container).filter(
      (card) => card.getAttribute('fill') === 'var(--strata-danger)',
    );
    expect(knotted.map((card) => card.getAttribute('aria-label'))).toEqual([
      'a',
      'b',
    ]);

    const cycleEdges = lines(ui.container).filter(
      (line) => line.getAttribute('stroke') === 'var(--strata-danger)',
    );
    expect(cycleEdges).toHaveLength(2);
  });

  it('reports the clicked node and marks it selected', () => {
    const onselect = vi.fn();
    ui = render(GraphCanvas, { ...props, selected: 'b', onselect });

    cardFor(ui.container, 'a').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expect(onselect).toHaveBeenCalledWith('a');
    expect(cardFor(ui.container, 'b').getAttribute('aria-pressed')).toBe('true');
  });

  it('fades everything outside the highlight', () => {
    ui = render(GraphCanvas, { ...props, highlight: new Set(['a', 'b']) });

    const opacity = (id: string) =>
      cardFor(ui.container, id).closest('g')!.getAttribute('opacity');

    expect(opacity('a')).toBe('1');
    expect(opacity('c')).toBe('0.25');
  });

  it('opens a closed folder when its card is clicked', () => {
    const nodes: GraphNode[] = [
      { id: 'src/a.ts', label: 'src/a.ts', kind: 'file' },
      { id: 'lib', label: 'lib', kind: 'module', meta: { files: 9 } },
    ];
    const ontoggle = vi.fn();
    ui = render(GraphCanvas, { nodes, edges: [], cycleOf: new Map(), ontoggle });

    ui.container
      .querySelector<SVGRectElement>('rect[aria-label="Open folder lib"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ontoggle).toHaveBeenCalledWith('lib');
  });

  it('closes an open folder from its container label', () => {
    const ontoggle = vi.fn();
    ui = render(GraphCanvas, {
      nodes: [
        { id: 'lib/a.ts', label: 'lib/a.ts', kind: 'file' as const },
        { id: 'lib/b.ts', label: 'lib/b.ts', kind: 'file' as const },
      ],
      edges: [],
      cycleOf: new Map(),
      open: new Set(['lib']),
      ontoggle,
    });

    ui.container
      .querySelector<SVGTextElement>('text[aria-label="Close folder lib"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ontoggle).toHaveBeenCalledWith('lib');
  });

  it('does not select what a pan happened to start on', () => {
    const onselect = vi.fn();
    ui = render(GraphCanvas, { ...props, onselect });

    const svg = ui.container.querySelector('svg')!;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }),
    );
    svg.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 40 }),
    );
    svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    cardFor(ui.container, 'a').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expect(onselect).not.toHaveBeenCalled();
  });

  it('still selects when the pointer did not move', () => {
    const onselect = vi.fn();
    ui = render(GraphCanvas, { ...props, onselect });

    const svg = ui.container.querySelector('svg')!;
    svg.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    cardFor(ui.container, 'a').dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    expect(onselect).toHaveBeenCalledWith('a');
  });

  it('says how many nodes it left out', () => {
    ui = render(GraphCanvas, { ...props, hidden: 7 });
    expect(ui.container.textContent).toContain('Drawing 3 of 10 nodes');
  });

  it('says so when no language claimed a file', () => {
    ui = render(GraphCanvas, { nodes: [], edges: [], cycleOf: new Map() });
    expect(ui.container.textContent).toContain('No dependency graph');
  });

  /** The zoom control doubles as a readout of how far in the reader is. */
  const zoomOf = (container: HTMLElement) =>
    container.querySelector('button[aria-label="Fit the whole graph"]')!
      .textContent!.trim();

  it('holds the reader’s zoom when opening a folder changes the drawing', async () => {
    const props = reactiveProps({
      nodes: graph.nodes,
      edges: graph.edges,
      cycleOf,
      revision: 'abc',
    });
    ui = render(GraphCanvas, props);
    // The view fits itself to the drawing on mount; zoom from there.
    await tick();

    ui.container
      .querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!
      .click();
    await tick();
    const zoomed = zoomOf(ui.container);
    expect(zoomed).not.toBe('1.0×');

    // Opening a folder changes the nodes, and so the size of the drawing.
    props.nodes = [
      ...graph.nodes,
      { id: 'd', label: 'd', kind: 'file' as const },
      { id: 'e', label: 'e', kind: 'file' as const },
    ];
    await tick();

    expect(zoomOf(ui.container)).toBe(zoomed);
  });

  it('starts from the whole graph when a new analysis arrives', async () => {
    const props = reactiveProps({
      nodes: graph.nodes,
      edges: graph.edges,
      cycleOf,
      revision: 'abc',
    });
    ui = render(GraphCanvas, props);
    await tick();

    ui.container
      .querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!
      .click();
    await tick();
    expect(zoomOf(ui.container)).not.toBe('1.0×');

    props.revision = 'def';
    await tick();

    expect(zoomOf(ui.container)).toBe('1.0×');
  });
});
