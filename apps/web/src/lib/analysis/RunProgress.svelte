<script lang="ts">
  import type { AnalysisProgress } from '$lib/api';
  import { progressFraction, progressLabel } from './label';

  /**
   * What a running analysis is doing, as one line and a bar.
   *
   * The bar is only drawn once the server knows how many steps the run holds —
   * before that it says what it is doing and nothing about how far along it is,
   * because a bar that jumps backwards when the plan firms up is worse than no
   * bar at all.
   */

  interface Props {
    progress: AnalysisProgress | null;
    /** Set false to leave out the bar where there is only room for the line. */
    bar?: boolean;
  }

  let { progress, bar = true }: Props = $props();

  let label = $derived(progressLabel(progress));
  let fraction = $derived(progressFraction(progress));
</script>

<div class="min-w-0" role="status" aria-live="polite">
  <p class="text-muted truncate text-xs">
    {label}{#if progress?.total}<span class="text-subtle">
        · {progress.completed}/{progress.total}</span
      >{/if}
  </p>
  {#if bar}
    <div
      class="bg-elevated mt-1 h-1 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-label="Analysis progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={fraction === null
        ? undefined
        : Math.round(fraction * 100)}
    >
      <!--
        A known fraction fills the bar; an unknown one sweeps, so the reader can
        tell "still working" from "one step in".
      -->
      <div
        class="bg-accent h-full rounded-full transition-[width] duration-300"
        class:animate-pulse={fraction === null}
        style:width={fraction === null ? '100%' : `${fraction * 100}%`}
      ></div>
    </div>
  {/if}
</div>
