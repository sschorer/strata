<script lang="ts">
  import type { LoadedPluginInfo } from '$lib/api';

  interface Props {
    plugins: LoadedPluginInfo[];
    /** Plugins that were found but could not be loaded. */
    failures?: number;
    /** True while the first response is still on the way. */
    loading?: boolean;
    /** Why the list is empty, when the server said so. */
    error?: string;
  }

  let {
    plugins,
    failures = 0,
    loading = false,
    error = '',
  }: Props = $props();
</script>

{#if error}
  <p class="text-warn text-sm">{error}</p>
{:else if loading && plugins.length === 0}
  <p class="text-muted text-sm">Loading plugins…</p>
{:else if plugins.length === 0}
  <p class="text-muted text-sm">
    No plugins loaded — an analysis over this workbench would find nothing.
  </p>
{:else}
  <ul class="divide-line flex flex-col divide-y">
    {#each plugins as plugin (plugin.id)}
      <li class="flex items-baseline justify-between gap-3 py-2 first:pt-0">
        <span class="min-w-0">
          <span class="block truncate text-sm">{plugin.name}</span>
          <span
            class="text-subtle block truncate font-mono text-xs"
            title={plugin.id}
          >
            {plugin.id}
          </span>
        </span>
        <span class="flex shrink-0 items-baseline gap-2">
          {#if plugin.source === 'user'}
            <span class="text-accent text-xs">user</span>
          {/if}
          <span
            class="border-line bg-elevated text-muted rounded-md border px-1.5 py-0.5 text-xs"
          >
            {plugin.kind}
          </span>
          <span class="text-subtle font-mono text-xs">v{plugin.version}</span>
        </span>
      </li>
    {/each}
  </ul>
{/if}

{#if failures > 0}
  <p class="text-warn mt-3 text-xs">
    {failures}
    {failures === 1 ? 'plugin was' : 'plugins were'} found but could not be loaded.
  </p>
{/if}
