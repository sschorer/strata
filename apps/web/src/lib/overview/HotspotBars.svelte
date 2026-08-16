<script lang="ts">
  import { compactNumber, dirName, fileName } from '$lib/format';
  import { heatColor, heatLevel, type HeatScale } from '$lib/hotspots';
  import type { HotspotBar } from './bars';

  interface Props {
    bars: HotspotBar[];
    /** The ramp fitted on the whole ranking, as the treemap fits it. */
    scale: HeatScale;
  }

  let { bars, scale }: Props = $props();

  const width = (share: number) => `${(share * 100).toFixed(1)}%`;
</script>

{#if bars.length === 0}
  <p class="text-muted text-sm">
    No hotspot scores in this report — nothing changed inside the analysed
    history window.
  </p>
{:else}
  <ul class="flex flex-col gap-3">
    {#each bars as bar (bar.path)}
      <li>
        <div class="flex items-baseline justify-between gap-3">
          <span class="truncate font-mono text-xs" title={bar.path}>
            <span class="text-subtle">{dirName(bar.path)}</span><span
              class="text-ink">{fileName(bar.path)}</span
            >
          </span>
          <span class="text-muted shrink-0 font-mono text-xs">
            {compactNumber(bar.score)}
          </span>
        </div>
        <!-- The number is printed beside it, so the bar is the comparison and
             nothing is said in colour alone. -->
        <div
          class="bg-elevated mt-1 h-1.5 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            class="h-full rounded-full"
            style="width: {width(bar.share)}; background: {heatColor(
              heatLevel(scale, bar.complexity),
            )};"
          ></div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
