<script lang="ts">
  import type { AnalysisReport } from '$lib/api';
  import { runDisplay } from './summary';

  interface Props {
    report: AnalysisReport | null;
  }

  let { report }: Props = $props();

  // The age keeps counting while the workbench sits open: a header that still
  // says "just now" an hour later is worse than no age at all.
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  let run = $derived(report ? runDisplay(report, now) : null);
</script>

{#if run}
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <span
      class="border-line bg-elevated flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
    >
      <span class="text-subtle">branch</span>
      <span class="truncate">{run.branch}</span>
    </span>
    <span
      class="border-line bg-elevated flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
    >
      <span class="text-subtle">rev</span>
      <span class="font-mono">{run.rev}</span>
    </span>
    <p class="text-subtle text-xs whitespace-nowrap">
      {run.files} files · {run.duration} · {run.age}
    </p>
  </div>
{:else}
  <p class="text-subtle text-xs">No analysis yet</p>
{/if}
