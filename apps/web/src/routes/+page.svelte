<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import ServerStatus from '$lib/components/ServerStatus.svelte';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import TokenPalette from '$lib/components/TokenPalette.svelte';
  import { theme } from '$lib/theme';
</script>

<svelte:head>
  <title>Strata</title>
</svelte:head>

<main class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-semibold">Strata</h1>
      <p class="text-muted mt-1 text-sm">
        Frontend scaffold — theme layer and API client in place. The workbench
        shell and the analysis screens come next.
      </p>
    </div>
    <ThemeSwitch />
  </header>

  <div class="grid gap-6 md:grid-cols-2">
    <Card title="Design tokens" hint={theme.resolved}>
      <TokenPalette />
    </Card>

    <Card title="Server" hint="/health · /plugins">
      <ServerStatus />
    </Card>
  </div>
</main>
