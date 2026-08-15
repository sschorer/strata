<script lang="ts">
  import { compactNumber } from '$lib/format';
  import { heatBands, heatColor, type HeatScale } from './heat';

  interface Props {
    scale: HeatScale;
    /** What the ramp encodes; the tiles' size is labelled separately. */
    label?: string;
  }

  let { scale, label = 'Complexity' }: Props = $props();

  let bands = $derived(heatBands(scale));
</script>

<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
  <span class="text-subtle text-xs">{label}</span>
  <ul class="flex items-stretch">
    {#each bands as band (band.level)}
      <li class="flex flex-col items-center gap-1">
        <span
          class="border-bg/60 block h-3 w-12 border-r first:rounded-l-sm last:rounded-r-sm last:border-r-0"
          style="background: {heatColor(band.level)};"
          aria-hidden="true"
        ></span>
        <span class="text-subtle font-mono text-[10px]">
          {compactNumber(band.to)}
        </span>
      </li>
    {/each}
  </ul>
  <span class="text-subtle text-xs">
    cold {compactNumber(scale.min)} → hot {compactNumber(scale.max)}
  </span>
</div>
