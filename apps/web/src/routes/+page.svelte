<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import ServerStatus from '$lib/components/ServerStatus.svelte';
  import TokenPalette from '$lib/components/TokenPalette.svelte';
  import { theme } from '$lib/theme';
</script>

<svelte:head>
  <title>Overview · Strata</title>
</svelte:head>

<header class="mb-8">
  <h1 class="text-2xl font-semibold">Overview</h1>
  <p class="text-muted mt-1 text-sm">
    The shell is in place — rail, header and a scrolling pane. The overview's
    stat cards, the commit analytics and the dead-code table land next; until
    then, the workbench's own state.
  </p>
  <p class="mt-3 flex flex-wrap gap-4 text-sm">
    <a class="text-accent underline-offset-4 hover:underline" href="/hotspots">
      Hotspots →
    </a>
    <a class="text-accent underline-offset-4 hover:underline" href="/graph">
      Dependencies →
    </a>
  </p>
</header>

<div class="grid gap-6 md:grid-cols-2">
  <Card title="Design tokens" hint={theme.resolved}>
    <TokenPalette />
  </Card>

  <Card title="Server" hint="/health · /plugins">
    <ServerStatus />
  </Card>
</div>
