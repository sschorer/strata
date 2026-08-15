<script lang="ts">
  import type { GraphEdge, GraphNode } from '@strata/sdk';
  import { degrees } from './degree';
  import {
    classifyEdges,
    edgeDash,
    edgeKey,
    edgeStroke,
    edgeWidth,
    type EdgeClass,
  } from './edges';
  import { untrack } from 'svelte';
  import { layeredLayout, type Box } from './layered';
  import {
    centreOf,
    magnification,
    pannedTo,
    rewrapped,
    viewportOf,
    zoomedBy,
    type Point,
    type Viewport,
  } from './viewport';

  interface Props {
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** `node id → cycle number`; a node in the map is drawn as a cycle node. */
    cycleOf: ReadonlyMap<string, number>;
    /** The folders standing open — each gets a container of its own. */
    open?: ReadonlySet<string>;
    /** What to call a node on its card. */
    labelOf?: (id: string) => string;
    selected?: string | null;
    /**
     * Ids to keep at full strength while everything else fades — the selected
     * node's neighbourhood, or a cycle. `null` draws the whole graph evenly.
     */
    highlight?: ReadonlySet<string> | null;
    /** Nodes the report has that this canvas does not draw. */
    hidden?: number;
    /**
     * Identifies the analysis on screen. The view resets when *this* changes —
     * a new run is a new picture — and holds still for everything else, so
     * opening a folder does not throw the reader back out to the whole graph.
     */
    revision?: string;
    onselect?: (id: string) => void;
    /** Open a closed folder, or close an open one. */
    ontoggle?: (folder: string) => void;
  }

  let {
    nodes,
    edges,
    cycleOf,
    open = new Set<string>(),
    labelOf = (id) => id,
    selected = null,
    highlight = null,
    hidden = 0,
    revision,
    onselect,
    ontoggle,
  }: Props = $props();

  /** Label size in drawing units. A card is one size, so this one always fits. */
  const LABEL_SIZE = 13;
  /** Rough width of one monospace character, as a share of its size. */
  const CHARACTER = 0.62;

  const EDGE_CLASSES: EdgeClass[] = ['local', 'package', 'cycle'];

  const isFolder = (node: GraphNode) => node.kind === 'module';

  let laid = $derived(layeredLayout(nodes, edges, { open }));
  let world = $derived(laid.world);
  let degree = $derived(degrees({ nodes, edges }));
  let classes = $derived(classifyEdges({ nodes, edges }, cycleOf));

  // Cycle arrows paint last, so a knot stays readable through the traffic.
  let arrows = $derived(
    edges
      .map((edge) => ({
        edge,
        edgeClass: classes.get(edgeKey(edge)) ?? ('local' as EdgeClass),
      }))
      .sort(
        (a, b) =>
          EDGE_CLASSES.indexOf(a.edgeClass) - EDGE_CLASSES.indexOf(b.edgeClass),
      ),
  );

  const fill = (node: GraphNode) => {
    if (cycleOf.has(node.id)) return 'var(--strata-danger)';
    if (isFolder(node)) return 'var(--strata-accent-soft)';
    if (node.kind === 'package') return 'var(--strata-elevated)';
    return 'var(--strata-surface)';
  };

  const ink = (node: GraphNode) =>
    cycleOf.has(node.id) ? 'var(--strata-h5-ink)' : 'var(--strata-ink)';

  const lit = (id: string) => highlight === null || highlight.has(id);

  /**
   * Where an arrow meets a card: on its edge, on the side the arrow comes
   * from, so the arrowhead lands on the box rather than inside it.
   */
  function rim(box: Box, at: Point, towards: Point): Point {
    const dx = towards.x - at.x;
    const dy = towards.y - at.y;
    const length = Math.hypot(dx, dy) || 1;
    const reach = Math.min(
      box.width / 2 / Math.max(Math.abs(dx), 1e-6),
      box.height / 2 / Math.max(Math.abs(dy), 1e-6),
    );
    return {
      x: at.x + (dx / length) * (reach * length + 4),
      y: at.y + (dy / length) * (reach * length + 4),
    };
  }

  function segment(from: string, to: string) {
    const a = laid.points.get(from);
    const b = laid.points.get(to);
    const boxA = laid.cards.get(from);
    const boxB = laid.cards.get(to);
    if (!a || !b || !boxA || !boxB) return null;

    const start = rim(boxA, a, b);
    const end = rim(boxB, b, a);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }

  /** Trim a name to what the card holds; the full one stays in the title. */
  const clip = (text: string, width: number) => {
    const room = Math.floor((width - 20) / (LABEL_SIZE * CHARACTER));
    return text.length <= room
      ? text
      : `${text.slice(0, Math.max(room - 1, 1))}…`;
  };

  // ---- Panning and zooming -------------------------------------------------
  // The layout never re-runs for either: both only move the window onto it.

  let svg: SVGSVGElement | undefined = $state();
  /** The room the page gives the canvas; the window takes its shape from it. */
  let boxWidth = $state(1000);
  let boxHeight = $state(640);
  // Before the first measurement the element reports nothing; a zero there
  // would divide the whole viewport into infinities, so fall back to the shape
  // the canvas is styled to have.
  let aspect = $derived(
    boxWidth > 0 && boxHeight > 0 ? boxWidth / boxHeight : 1000 / 640,
  );
  let view = $state<Viewport>(viewportOf(1000, 640));
  let grabbing = $state(false);
  /** A drag that moved is a pan, not a click on whatever it started over. */
  let dragged = false;
  let from = { x: 0, y: 0, viewX: 0, viewY: 0 };

  let zoom = $derived(magnification(view));

  // A new analysis is a new picture: start from the whole of it. Opening a
  // folder is not — it is the reader looking closer at the one they have.
  //
  // Everything but `revision` is read untracked on purpose. Reading `world`
  // here would make this effect run whenever the drawing changes, which is
  // exactly what opening a folder does — and the reader would be thrown back
  // out to the whole graph every time.
  $effect(() => {
    void revision;
    untrack(() => {
      view = viewportOf(world.width, world.height, aspect);
    });
  });

  // Opening a folder changes the drawing, and resizing the page changes the
  // shape of the window onto it. Carry the window across either, rather than
  // throwing the reader back out to the whole graph.
  $effect(() => {
    const shape = aspect;
    if (
      view.world.width !== world.width ||
      view.world.height !== world.height ||
      Math.abs(view.width / view.height - shape) > 1e-6
    ) {
      view = rewrapped(view, world, shape);
    }
  });

  /** Where in the drawing a pointer is — the box may be any size on screen. */
  function pointAt(event: { clientX: number; clientY: number }) {
    const box = svg?.getBoundingClientRect();
    const width = box?.width || boxWidth;
    const height = box?.height || boxHeight;
    return {
      x: view.x + ((event.clientX - (box?.left ?? 0)) / width) * view.width,
      y: view.y + ((event.clientY - (box?.top ?? 0)) / height) * view.height,
    };
  }

  function fit(): void {
    view = viewportOf(world.width, world.height, aspect);
  }

  function zoomBy(factor: number, at = centreOf(view)): void {
    view = zoomedBy(view, factor, at);
  }

  function onwheel(event: WheelEvent): void {
    event.preventDefault();
    zoomBy(Math.exp(-event.deltaY * 0.002), pointAt(event));
  }

  /**
   * Panning deliberately does *not* take pointer capture. Capturing retargets
   * every following `click` at the element that holds it, so the cards inside
   * the canvas would never see one — the pan would swallow every click.
   */
  function onpointerdown(event: PointerEvent): void {
    if (event.button !== 0) return;
    grabbing = true;
    dragged = false;
    from = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
  }

  function onpointermove(event: PointerEvent): void {
    if (!grabbing) return;
    const box = svg?.getBoundingClientRect();
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.hypot(dx, dy) > 3) dragged = true;
    view = pannedTo(
      view,
      from.viewX - (dx / (box?.width || boxWidth)) * view.width,
      from.viewY - (dy / (box?.height || boxHeight)) * view.height,
    );
  }

  function onpointerup(): void {
    grabbing = false;
  }

  function pick(node: GraphNode): void {
    if (dragged) return;
    if (isFolder(node)) ontoggle?.(node.id);
    else onselect?.(node.id);
  }

  function key(event: KeyboardEvent, node: GraphNode): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    pick(node);
  }

  function toggleKey(event: KeyboardEvent, folder: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    ontoggle?.(folder);
  }
</script>

{#if nodes.length === 0}
  <p class="text-muted text-sm">
    No dependency graph in this report — no language plugin claimed a file.
  </p>
{:else}
  <div
    class="border-line bg-bg relative h-[68vh] max-h-[900px] min-h-[380px]
           overflow-hidden rounded-lg border"
    bind:clientWidth={boxWidth}
    bind:clientHeight={boxHeight}
  >
    <svg
      bind:this={svg}
      class="block h-full w-full touch-none {grabbing
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      viewBox="{view.x} {view.y} {view.width} {view.height}"
      role="group"
      aria-label="Dependency graph: {nodes.length} nodes, {edges.length} edges"
      {onwheel}
      {onpointerdown}
      {onpointermove}
      {onpointerup}
      onpointerleave={onpointerup}
      onpointercancel={onpointerup}
    >
      <defs>
        {#each EDGE_CLASSES as edgeClass (edgeClass)}
          <marker
            id="strata-arrow-{edgeClass}"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="9"
            markerHeight="9"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 8 4 L 0 8 z" fill={edgeStroke(edgeClass)} />
          </marker>
        {/each}
      </defs>

      <!-- The folders standing open: a dashed container around their cards. -->
      <g>
        {#each [...laid.groups].sort((a, b) => a.depth - b.depth) as group (group.path)}
          <rect
            x={group.x}
            y={group.y}
            width={group.width}
            height={group.height}
            rx="8"
            fill="var(--strata-surface)"
            fill-opacity="0.35"
            stroke="var(--strata-line-strong)"
            stroke-dasharray="6 5"
          />
          <text
            x={group.x + 12}
            y={group.y + LABEL_SIZE * 1.2}
            font-size={LABEL_SIZE}
            fill="var(--strata-subtle)"
            role="button"
            tabindex="0"
            class="cursor-pointer select-none"
            aria-label="Close folder {group.path}"
            onclick={() => !dragged && ontoggle?.(group.path)}
            onkeydown={(event) => toggleKey(event, group.path)}
          >
            ▾ {group.name}
          </text>
        {/each}
      </g>

      <g>
        {#each arrows as { edge, edgeClass } (edgeKey(edge))}
          {@const line = segment(edge.from, edge.to)}
          {#if line}
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={edgeStroke(edgeClass)}
              stroke-width={edgeWidth(edgeClass) *
                Math.min(1 + Math.log2(edge.weight ?? 1), 3)}
              stroke-dasharray={edgeDash(edgeClass)}
              marker-end="url(#strata-arrow-{edgeClass})"
              opacity={lit(edge.from) && lit(edge.to) ? 0.8 : 0.1}
            >
              <title>
                {labelOf(edge.from)} → {labelOf(edge.to)}{edge.weight &&
                edge.weight > 1
                  ? ` · ${edge.weight} imports`
                  : ''}
              </title>
            </line>
          {/if}
        {/each}
      </g>

      <g>
        {#each nodes as node (node.id)}
          {@const box = laid.cards.get(node.id)}
          {#if box}
            {@const cycle = cycleOf.get(node.id)}
            {@const folder = isFolder(node)}
            <g opacity={lit(node.id) ? 1 : 0.25}>
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx="7"
                fill={fill(node)}
                stroke={selected === node.id
                  ? 'var(--strata-ink)'
                  : cycleOf.has(node.id)
                    ? 'var(--strata-danger)'
                    : folder
                      ? 'var(--strata-accent)'
                      : 'var(--strata-line-strong)'}
                stroke-width={selected === node.id ? 3 : 1.5}
                role="button"
                tabindex="0"
                aria-pressed={selected === node.id}
                aria-label={folder ? `Open folder ${node.id}` : node.id}
                class="cursor-pointer"
                onclick={() => pick(node)}
                onkeydown={(event) => key(event, node)}
              >
                <title>
                  {#if folder}
                    {node.id} — {node.meta?.files} files, closed
                  {:else}
                    {node.id} — {degree.fanIn.get(node.id) ?? 0} in, {degree.fanOut.get(
                      node.id,
                    ) ?? 0} out{cycle === undefined ? '' : ` · cycle ${cycle}`}
                  {/if}
                </title>
              </rect>
              <text
                x={box.x + 11}
                y={box.y + box.height / 2 + LABEL_SIZE * 0.36}
                font-size={LABEL_SIZE}
                fill={ink(node)}
                class="pointer-events-none select-none"
              >
                {folder ? '▸ ' : ''}{clip(labelOf(node.id), box.width)}
              </text>
            </g>
          {/if}
        {/each}
      </g>
    </svg>

    <div class="absolute top-2 right-2 flex gap-1">
      <button
        type="button"
        class="border-line bg-surface text-muted hover:text-ink size-7 rounded-md border font-mono text-sm"
        aria-label="Zoom out"
        onclick={() => zoomBy(1 / 1.4)}
      >
        −
      </button>
      <button
        type="button"
        class="border-line bg-surface text-muted hover:text-ink h-7 rounded-md border px-2 font-mono text-xs"
        aria-label="Fit the whole graph"
        onclick={fit}
      >
        {zoom.toFixed(1)}×
      </button>
      <button
        type="button"
        class="border-line bg-surface text-muted hover:text-ink size-7 rounded-md border font-mono text-sm"
        aria-label="Zoom in"
        onclick={() => zoomBy(1.4)}
      >
        +
      </button>
    </div>
  </div>

  <p class="text-subtle mt-2 flex flex-wrap gap-x-3 text-xs">
    <span>
      Drag to pan · scroll to zoom · click a folder to open or close it.
    </span>
    {#if hidden > 0}
      <span>
        Drawing {nodes.length} of {nodes.length + hidden} nodes — cycles first, then
        the busiest.
      </span>
    {/if}
  </p>
{/if}
