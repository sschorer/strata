<script lang="ts">
  import { plugins } from '$lib/plugins';

  // The rail is on screen for the whole session, so this is where the app-wide
  // plugin list gets loaded — once, whatever screen the reader opened on.
  $effect(() => {
    plugins.load();
  });

  let count = $derived(plugins.count);
</script>

<div class="text-xs">
  {#if plugins.status === 'error'}
    <p class="text-warn">Server unreachable</p>
    <p class="text-subtle mt-0.5">Plugins unknown</p>
  {:else if count === null}
    <p class="text-subtle">Loading plugins…</p>
  {:else}
    <p class="text-muted">
      <span class="text-ink font-mono">{count}</span>
      {count === 1 ? 'plugin' : 'plugins'} loaded
    </p>
    {#if plugins.failures > 0}
      <p class="text-warn mt-0.5">
        {plugins.failures} skipped
      </p>
    {/if}
  {/if}
</div>
