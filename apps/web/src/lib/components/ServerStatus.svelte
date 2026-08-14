<script lang="ts">
  import { API_BASE, ApiError, fetchHealth, fetchPlugins } from '$lib/api';
  import type { PluginsResponse } from '$lib/api';

  let status = $state<'loading' | 'ok' | 'error'>('loading');
  let health = $state('');
  let plugins = $state<PluginsResponse | null>(null);
  let error = $state('');

  // Proof that the client, the dev proxy and the API line up. The real screens
  // will load through route loaders instead.
  $effect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [healthResponse, pluginsResponse] = await Promise.all([
          fetchHealth(controller.signal),
          fetchPlugins(controller.signal),
        ]);
        health = healthResponse.status;
        plugins = pluginsResponse;
        status = 'ok';
      } catch (err) {
        if (controller.signal.aborted) return;
        error =
          err instanceof ApiError ? err.message : 'Unexpected client error.';
        status = 'error';
      }
    })();
    return () => controller.abort();
  });
</script>

{#if status === 'loading'}
  <p class="text-muted text-sm">Contacting the server…</p>
{:else if status === 'error'}
  <p class="text-danger text-sm">{error}</p>
  <p class="text-subtle mt-2 text-xs">
    Start it with <code class="font-mono">make dev</code>.
  </p>
{:else if plugins}
  <dl class="space-y-3 text-sm">
    <div class="flex items-baseline justify-between gap-4">
      <dt class="text-muted">Health</dt>
      <dd class="text-ok font-mono">{health}</dd>
    </div>
    <div class="flex items-baseline justify-between gap-4">
      <dt class="text-muted">API origin</dt>
      <dd class="text-subtle truncate font-mono text-xs">
        {API_BASE || 'same origin'}
      </dd>
    </div>
    <div class="flex items-baseline justify-between gap-4">
      <dt class="text-muted">Plugins directory</dt>
      <dd class="text-subtle truncate font-mono text-xs">
        {plugins.directory}
      </dd>
    </div>
  </dl>

  <ul class="border-line mt-4 space-y-2 border-t pt-4">
    {#each plugins.plugins as plugin (plugin.id)}
      <li class="flex items-baseline justify-between gap-3 text-sm">
        <span class="truncate">{plugin.name}</span>
        <span class="text-subtle shrink-0 font-mono text-xs">
          {plugin.kind} · {plugin.source}
        </span>
      </li>
    {/each}
  </ul>

  {#if plugins.failures.length > 0}
    <p class="text-warn mt-3 text-xs">
      {plugins.failures.length} plugin(s) skipped.
    </p>
  {/if}
{/if}
