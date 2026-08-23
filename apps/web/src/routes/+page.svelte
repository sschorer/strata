<script lang="ts">
  import { analysis } from '$lib/analysis';
  import Card from '$lib/components/Card.svelte';
  import { heatScale, hotspotRows, HOTSPOT_STAGE_ID } from '$lib/hotspots';
  import { plugins } from '$lib/plugins';
  import { commitTypes, hotspotBars, overviewStats } from '$lib/overview';
  import CommitTypes from '$lib/overview/CommitTypes.svelte';
  import CycleAlert from '$lib/overview/CycleAlert.svelte';
  import HotspotBars from '$lib/overview/HotspotBars.svelte';
  import PluginList from '$lib/overview/PluginList.svelte';
  import StatGrid from '$lib/overview/StatGrid.svelte';
  import {
    outputsProducing,
    soleOutputOf,
    troubleOf,
    troublesProducing,
  } from '$lib/stages';
  import StageNotice from '$lib/stages/StageNotice.svelte';

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

  let cycles = $derived(report?.dependencies.cycles ?? []);
  // The parsed log of whichever convention parsed it — the conventions are an
  // exclusive group, so a run has one or none.
  let commits = $derived(report ? (soleOutputOf(report, 'commits') ?? []) : []);
  let types = $derived(commitTypes(commits));
  let stats = $derived(
    report
      ? overviewStats(report, {
          loaded: plugins.count,
          failures: plugins.failures,
        })
      : [],
  );

  // What is missing, panel by panel: each card asks about the stages behind its
  // own contents, and prints them there rather than leaving an empty panel that
  // reads as good news (`docs/adr/0015`).
  let hotspotTrouble = $derived(
    report ? troubleOf(report, HOTSPOT_STAGE_ID) : null,
  );
  let graphTroubles = $derived(
    report ? troublesProducing(report, 'graph') : [],
  );
  let graphProduced = $derived(
    report ? outputsProducing(report, 'graph').length > 0 : false,
  );
  let commitTroubles = $derived(
    report ? troublesProducing(report, 'commits') : [],
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
      stages={report?.stages ?? {}}
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
          {#if hotspotTrouble}
            <StageNotice
              troubles={[hotspotTrouble]}
              what="the hotspot ranking"
            />
          {:else}
            <HotspotBars {bars} {scale} />
          {/if}
        </Card>

        <Card
          title="Commit types"
          hint="{commits.length} {commits.length === 1 ? 'commit' : 'commits'}"
        >
          {#if commitTroubles.length > 0}
            <StageNotice troubles={commitTroubles} what="the parsed history" />
          {:else}
            <CommitTypes {types} />
          {/if}
        </Card>
      </div>

      <div class="flex flex-col gap-6">
        <Card
          title="Import cycles"
          hint={cycles.length > 0 ? 'biggest first' : 'none'}
        >
          {#if graphTroubles.length > 0}
            <StageNotice
              troubles={graphTroubles}
              what="its part of the import graph"
            />
          {/if}
          {#if graphProduced}
            <div class:mt-3={graphTroubles.length > 0}>
              <CycleAlert {cycles} />
            </div>
          {:else if graphTroubles.length === 0}
            <p class="text-muted text-sm">
              No stage in this report produced a dependency graph, so nothing
              here knows what imports what.
            </p>
          {/if}
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
