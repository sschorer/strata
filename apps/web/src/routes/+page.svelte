<script lang="ts">
  import { analysis } from '$lib/analysis';
  import Card from '$lib/components/Card.svelte';
  import { cycleViews, mergedGraph } from '$lib/graph';
  import { heatScale, hotspotRows } from '$lib/hotspots';
  import { plugins } from '$lib/plugins';
  import { commitTypes, hotspotBars, overviewStats } from '$lib/overview';
  import CommitTypes from '$lib/overview/CommitTypes.svelte';
  import CycleAlert from '$lib/overview/CycleAlert.svelte';
  import HotspotBars from '$lib/overview/HotspotBars.svelte';
  import PluginList from '$lib/overview/PluginList.svelte';
  import StatGrid from '$lib/overview/StatGrid.svelte';

  // Load-once, and the rail has already asked: this is here so the screen
  // stands on its own — mounted without the frame, it still knows its plugins.
  $effect(() => {
    plugins.load();
  });

  let report = $derived(analysis.report);

  let rows = $derived(report ? hotspotRows(report) : []);
  // The ramp is fitted to the whole ranking, as the treemap fits it, so a bar
  // here and a tile there are the same colour for the same file.
  let scale = $derived(heatScale(rows.map((row) => row.complexity)));
  let bars = $derived(hotspotBars(rows));

  let cycles = $derived(report ? cycleViews(mergedGraph(report)) : []);
  let types = $derived(report ? commitTypes(report.commits) : []);
  let stats = $derived(
    report
      ? overviewStats(report, {
          loaded: plugins.count,
          failures: plugins.failures,
        })
      : [],
  );

  let loaded = $derived(plugins.response?.plugins ?? []);
</script>

<svelte:head>
  <title>Overview · Strata</title>
</svelte:head>

<!-- What the workbench loaded is true with or without a report, so the card is
     written once and stands in both states of the screen. -->
{#snippet pluginCard()}
  <Card
    title="Plugins"
    hint={loaded.length > 0 ? `${loaded.length} loaded` : ''}
  >
    <!-- `count` is null until the response lands, which covers the tick before
         the effect above has even asked — an empty list is not yet an answer. -->
    <PluginList
      plugins={loaded}
      failures={plugins.failures}
      loading={plugins.count === null}
      error={plugins.error}
    />
  </Card>
{/snippet}

<div>
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">Overview</h1>
    <p class="text-muted mt-1 max-w-3xl text-sm">
      The last run at a glance: how big the repository is, where maintenance
      cost concentrates, whether the imports knot, and what the workbench
      brought to the analysis.
    </p>
  </header>

  {#if analysis.status === 'error'}
    <p class="text-danger mb-6 text-sm">{analysis.error}</p>
  {/if}

  {#if report}
    <StatGrid cards={stats} />

    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div class="flex flex-col gap-6">
        <Card title="Top hotspots" hint="churn × complexity">
          <HotspotBars {bars} {scale} />
        </Card>

        <Card
          title="Commit types"
          hint="{report.commits.length} {report.commits.length === 1
            ? 'commit'
            : 'commits'}"
        >
          <CommitTypes {types} />
        </Card>
      </div>

      <div class="flex flex-col gap-6">
        <Card
          title="Import cycles"
          hint={cycles.length > 0 ? 'biggest first' : 'none'}
        >
          <CycleAlert {cycles} />
        </Card>

        {@render pluginCard()}
      </div>
    </div>
  {:else}
    {#if analysis.status === 'running'}
      <p class="text-muted mb-6 text-sm">Running the pipeline…</p>
    {:else}
      <p class="text-muted mb-6 text-sm">
        Pick a project in the switcher — or add one — and analyse it to see its
        overview.
      </p>
    {/if}

    <!-- The plugins are the one thing an empty overview can honestly show. -->
    <div class="max-w-xl">
      {@render pluginCard()}
    </div>
  {/if}
</div>
