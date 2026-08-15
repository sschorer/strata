<script lang="ts">
  import type { GraphSummary } from '@strata/sdk';
  import { compactNumber, fileName } from '$lib/format';

  interface Props {
    summary: GraphSummary;
  }

  let { summary }: Props = $props();
</script>

<dl class="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
  <div>
    <dt class="text-subtle text-xs">Nodes</dt>
    <dd class="font-mono text-lg">{compactNumber(summary.nodes)}</dd>
  </div>
  <div>
    <dt class="text-subtle text-xs">Edges</dt>
    <dd class="font-mono text-lg">{compactNumber(summary.edges)}</dd>
  </div>
  <div>
    <dt class="text-subtle text-xs">Cycles</dt>
    <dd class="font-mono text-lg {summary.cycles > 0 ? 'text-danger' : ''}">
      {compactNumber(summary.cycles)}
    </dd>
    {#if summary.cycles > 0}
      <p class="text-subtle text-xs">{summary.cycleNodes} files</p>
    {/if}
  </div>
  <div class="col-span-2 sm:col-span-3">
    <dt class="text-subtle text-xs">Max fan-in</dt>
    <dd class="font-mono text-sm">
      {#if summary.maxFanIn}
        <span title={summary.maxFanIn.id}>
          {fileName(summary.maxFanIn.id)}
        </span>
        <span class="text-muted">· {summary.maxFanIn.count}</span>
      {:else}
        —
      {/if}
    </dd>
  </div>
  <div class="col-span-2 sm:col-span-3">
    <dt class="text-subtle text-xs">Max fan-out</dt>
    <dd class="font-mono text-sm">
      {#if summary.maxFanOut}
        <span title={summary.maxFanOut.id}>
          {fileName(summary.maxFanOut.id)}
        </span>
        <span class="text-muted">· {summary.maxFanOut.count}</span>
      {:else}
        —
      {/if}
    </dd>
  </div>
</dl>
