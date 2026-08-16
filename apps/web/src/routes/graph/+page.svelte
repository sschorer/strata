<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { analysis } from '$lib/analysis';
  import RunForm from '$lib/analysis/RunForm.svelte';
  import Card from '$lib/components/Card.svelte';
  import { compactNumber } from '$lib/format';
  import CycleList from '$lib/graph/CycleList.svelte';
  import EdgeLegend from '$lib/graph/EdgeLegend.svelte';
  import GraphCanvas from '$lib/graph/GraphCanvas.svelte';
  import GraphStats from '$lib/graph/GraphStats.svelte';
  import FolderTree from '$lib/graph/FolderTree.svelte';
  import {
    classifyEdges,
    collapsedMembership,
    collapseFolders,
    containerOf,
    cycleMembership,
    cycleViews,
    degrees,
    everyFolder,
    focusGraph,
    folderRows,
    folderTree,
    mergedGraph,
    reportSummary,
    neighbourhood,
  } from '$lib/graph';

  /** Past this many shapes the picture stops being readable — see `focusGraph`. */
  const NODE_LIMIT = 140;
  /** A graph bigger than this opens with its folders closed. */
  const CLOSED_ABOVE = 60;

  /** A card shows a node's name below the open folder it sits in. */
  const shortLabel = (id: string) => {
    const folder = [...openFolders]
      .filter((path) => id.startsWith(`${path}/`))
      .sort((a, b) => b.length - a.length)[0];
    return folder ? id.slice(folder.length + 1) : id;
  };

  let report = $derived(analysis.report);
  let graph = $derived(report ? mergedGraph(report) : null);
  // The summary and the cycle list describe the repository, not the current
  // view: closing a folder hides files, it does not un-import them. The counts
  // come from the run itself — the language modules report them.
  let summary = $derived(report ? reportSummary(report) : null);
  let cycles = $derived(graph ? cycleViews(graph) : []);
  let cycleOf = $derived(cycleMembership(cycles));
  // The folder tree of the repository, whatever is open: the panel lists it
  // all, and closing a folder must not remove the row that reopens it.
  let tree = $derived(
    folderTree(
      (graph?.nodes ?? []).map((node) => ({
        id: node.id,
        container: containerOf(node.id),
        weight: 1,
      })),
    ),
  );
  let degree = $derived(degrees(graph ?? { nodes: [], edges: [] }));

  let collapsed = $state(new SvelteSet<string>());
  let rows = $derived(folderRows(tree, collapsed, cycleOf));

  let selectedNode = $state<string | null>(null);
  let selectedCycle = $state<number | null>(null);

  let folded = $derived(graph ? collapseFolders(graph, collapsed) : null);
  /** Folders that are open *and* actually hold something drawn. */
  let openFolders = $derived(
    new Set(
      everyFolder(tree)
        .map((folder) => folder.path)
        .filter((path) => path !== '' && !collapsed.has(path)),
    ),
  );
  let drawn = $derived(folded ? focusGraph(folded, NODE_LIMIT) : null);
  let drawnCycleOf = $derived(
    collapsedMembership(cycleOf, folded?.representative ?? new Map()),
  );
  // The legend follows the drawing rather than the other way round.
  let edgeClasses = $derived(
    new Set(
      classifyEdges(drawn ?? { nodes: [], edges: [] }, drawnCycleOf).values(),
    ),
  );

  let detail = $derived(
    drawn?.nodes.find(
      (node) => node.id === selectedNode && node.kind !== 'module',
    ) ?? null,
  );
  let loc = $derived(
    typeof detail?.meta?.loc === 'number' ? detail.meta.loc : null,
  );

  let highlight = $derived.by(() => {
    if (selectedNode && drawn) return neighbourhood(drawn.edges, selectedNode);
    if (selectedCycle === null) return null;
    const cycle = cycles.find((entry) => entry.index === selectedCycle);
    if (!cycle) return null;
    // A cycle inside a closed folder lights the folder up instead.
    return new Set(
      cycle.members.map(
        (id) => folded?.representative.get(id) ?? id,
      ),
    );
  });

  function selectNode(id: string): void {
    selectedNode = selectedNode === id ? null : id;
    selectedCycle = selectedNode ? (cycleOf.get(selectedNode) ?? null) : null;
  }

  function selectCycle(index: number): void {
    selectedCycle = selectedCycle === index ? null : index;
    selectedNode = null;
  }

  function toggleFolder(path: string): void {
    if (collapsed.has(path)) collapsed.delete(path);
    else collapsed.add(path);
    // Whatever was highlighted may have just been folded away.
    selectedNode = null;
  }

  function toggleAll(close: boolean): void {
    collapsed.clear();
    if (close) {
      // Only the top level: closing every folder would fold the whole tree
      // into one circle, which is nothing to look at.
      for (const folder of tree.folders) collapsed.add(folder.path);
    }
    selectedNode = null;
  }

  // A new report invalidates the selection and decides how much to show: a
  // repository large enough to be a hairball opens as its top-level folders.
  //
  // Everything below runs untracked on purpose. Reading — never mind writing —
  // `collapsed` inside a tracked effect makes opening a folder re-run this and
  // close it again, which is exactly as maddening as it sounds.
  $effect(() => {
    void report;
    untrack(() => {
      selectedNode = null;
      selectedCycle = null;
      collapsed.clear();
      if (tree.size <= CLOSED_ABOVE) return;
      // One card per top-level folder: the first look is the architecture.
      for (const folder of everyFolder(tree)) {
        if (folder.path !== '') collapsed.add(folder.path);
      }
    });
  });
</script>

<svelte:head>
  <title>Dependencies · Strata</title>
</svelte:head>

<div>
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">Dependencies</h1>
    <p class="text-muted mt-1 max-w-3xl text-sm">
      The import graph, grouped by folder. Closed folders are one node, so the
      picture starts as the architecture; open the ones you care about to see
      their files. A file inside an import cycle is red, and so is every edge of
      that knot.
    </p>
  </header>

  <div class="mb-6">
    <Card title="Analysis" hint={report ? `rev ${report.rev.slice(0, 8)}` : ''}>
      <RunForm />
      {#if analysis.status === 'error'}
        <p class="text-danger mt-3 text-sm">{analysis.error}</p>
      {/if}
    </Card>
  </div>

  {#if analysis.status === 'idle'}
    <p class="text-muted text-sm">
      Point Strata at a repository above to see how it imports itself.
    </p>
  {:else if analysis.status === 'running' && !report}
    <p class="text-muted text-sm">Running the pipeline…</p>
  {:else if drawn && summary}
    <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Graph" hint="{summary.nodes} files · {summary.edges} imports">
        <div class="mb-4">
          <EdgeLegend present={edgeClasses} />
        </div>
        <GraphCanvas
          nodes={drawn.nodes}
          edges={drawn.edges}
          cycleOf={drawnCycleOf}
          open={openFolders}
          labelOf={shortLabel}
          {highlight}
          hidden={drawn.hidden}
          revision={report?.rev}
          selected={selectedNode}
          onselect={selectNode}
          ontoggle={toggleFolder}
        />

        {#if detail}
          <dl
            class="border-line mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-4"
          >
            <div class="col-span-2 sm:col-span-4">
              <dt class="text-subtle text-xs">Selected</dt>
              <dd class="truncate font-mono text-xs" title={detail.id}>
                {detail.id}
              </dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Fan-in</dt>
              <dd class="font-mono">{degree.fanIn.get(detail.id) ?? 0}</dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Fan-out</dt>
              <dd class="font-mono">{degree.fanOut.get(detail.id) ?? 0}</dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">LOC</dt>
              <dd class="font-mono">
                {loc === null ? '—' : compactNumber(loc)}
              </dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Cycle</dt>
              <dd class="font-mono">
                {cycleOf.has(detail.id) ? `#${cycleOf.get(detail.id)}` : '—'}
              </dd>
            </div>
          </dl>
        {/if}
      </Card>

      <div class="flex flex-col gap-6">
        <Card title="Summary" hint="nodes · edges · cycles · fan-in">
          <GraphStats {summary} />
        </Card>

        <Card title="Folders" hint="click to open or close">
          <FolderTree {rows} ontoggle={toggleFolder} onall={toggleAll} />
        </Card>

        <Card
          title="Import cycles"
          hint={summary.cycles > 0 ? `${summary.cycles} found` : 'none'}
        >
          <CycleList
            {cycles}
            selected={selectedCycle}
            onselect={selectCycle}
          />
        </Card>
      </div>
    </div>
  {/if}
</div>
