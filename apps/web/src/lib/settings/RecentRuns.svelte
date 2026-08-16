<script lang="ts">
  import type { ProjectAnalysis } from '$lib/api';
  import { recentRows } from './recent-rows';

  /**
   * What the last few runs over this project found. The ages keep counting
   * while the screen sits open, as the header's summary does — a list that
   * still says "just now" an hour later is worse than no age at all.
   */

  interface Props {
    runs: readonly ProjectAnalysis[];
  }

  let { runs }: Props = $props();

  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  let rows = $derived(recentRows(runs, now));
</script>

{#if rows.length === 0}
  <p class="text-muted text-sm">
    No run recorded yet. The first analysis of this project shows up here.
  </p>
{:else}
  <ul class="divide-line flex flex-col divide-y">
    {#each rows as row (row.id)}
      <li
        class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 first:pt-0 last:pb-0"
      >
        <span class="flex min-w-0 items-baseline gap-2">
          <span class="font-mono text-sm">{row.rev}</span>
          <span class="text-subtle truncate text-xs">{row.branch}</span>
        </span>
        <span class="text-muted text-xs whitespace-nowrap">
          {row.files} files · {row.duration} · {row.age}
        </span>
      </li>
    {/each}
  </ul>
{/if}
