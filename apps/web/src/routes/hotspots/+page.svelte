<script lang="ts">
  import { analysis } from '$lib/analysis';
  import Card from '$lib/components/Card.svelte';
  import { compactNumber } from '$lib/format';
  import HeatLegend from '$lib/hotspots/HeatLegend.svelte';
  import RankedTable from '$lib/hotspots/RankedTable.svelte';
  import Treemap from '$lib/hotspots/Treemap.svelte';
  import { heatScale, hotspotRows } from '$lib/hotspots';

  let report = $derived(analysis.report);
  let rows = $derived(report ? hotspotRows(report) : []);
  // The ramp is fitted to what is on screen, so it stays informative on a repo
  // whose complexity spans two orders of magnitude and on one that does not.
  let scale = $derived(heatScale(rows.map((row) => row.complexity)));

  let selected = $state<string | null>(null);
  let detail = $derived(rows.find((row) => row.path === selected) ?? null);

  function select(path: string): void {
    selected = selected === path ? null : path;
  }

  // A new report invalidates whatever tile was highlighted.
  $effect(() => {
    void report;
    selected = null;
  });
</script>

<svelte:head>
  <title>Hotspots · Strata</title>
</svelte:head>

<div>
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">Hotspots</h1>
    <p class="text-muted mt-1 max-w-3xl text-sm">
      Churn × complexity: files that change often <em>and</em> are dense are
      where maintenance cost concentrates. Tiles are sized by score and coloured
      by complexity.
    </p>
  </header>

  {#if analysis.status === 'error'}
    <p class="text-danger mb-6 text-sm">{analysis.error}</p>
  {/if}

  {#if !report && analysis.status !== 'running'}
    <p class="text-muted text-sm">
      Pick a project in the switcher — or add one — and analyse it to see its
      hotspots.
    </p>
  {:else if analysis.status === 'running' && !report}
    <p class="text-muted text-sm">Running the pipeline…</p>
  {:else if report && rows.length === 0}
    <p class="text-muted text-sm">
      No hotspot scores in this report — the <code class="font-mono"
        >git-hotspots</code
      > plugin found no file that changed inside the analysed history window.
    </p>
  {:else if report}
    <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Treemap" hint="{rows.length} scored files">
        <div class="mb-4">
          <HeatLegend {scale} />
        </div>
        <Treemap {rows} {scale} {selected} onselect={select} />

        {#if detail}
          <dl
            class="border-line mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-sm sm:grid-cols-4"
          >
            <div class="col-span-2 sm:col-span-4">
              <dt class="text-subtle text-xs">Selected</dt>
              <dd class="truncate font-mono text-xs" title={detail.path}>
                {detail.path}
              </dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Churn</dt>
              <dd class="font-mono">{detail.churn}</dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Complexity</dt>
              <dd class="font-mono">{compactNumber(detail.complexity)}</dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">LOC</dt>
              <dd class="font-mono">
                {detail.loc === null ? '—' : compactNumber(detail.loc)}
              </dd>
            </div>
            <div>
              <dt class="text-subtle text-xs">Score</dt>
              <dd class="font-mono">{compactNumber(detail.score)}</dd>
            </div>
          </dl>
        {/if}
      </Card>

      <Card title="Ranked" hint="churn · complexity · LOC · score">
        <RankedTable {rows} {scale} {selected} onselect={select} />
      </Card>
    </div>
  {/if}
</div>
