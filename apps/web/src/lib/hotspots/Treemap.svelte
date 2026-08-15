<script lang="ts">
  import { compactNumber, fileName } from '$lib/format';
  import { heatColor, heatInk, heatLevel, type HeatScale } from './heat';
  import { squarify } from '$lib/geometry';
  import type { HotspotRow } from './rows';

  interface Props {
    rows: HotspotRow[];
    scale: HeatScale;
    /** How many of the top files get a tile; the rest would be sub-pixel. */
    limit?: number;
    selected?: string | null;
    onselect?: (path: string) => void;
  }

  let { rows, scale, limit = 48, selected = null, onselect }: Props = $props();

  // The box is 16:9, so the layout gets the same ratio and every tile can be
  // positioned in percentages — no measuring, no resize observer.
  const BOX_WIDTH = 16;
  const BOX_HEIGHT = 9;

  let shown = $derived(rows.slice(0, limit));
  let tiles = $derived(
    squarify(shown, (row) => row.score, BOX_WIDTH, BOX_HEIGHT),
  );

  const percent = (value: number, of: number) => `${(value / of) * 100}%`;

  /** Below this the label would be clipped to a letter or two — drop it. */
  const fits = (width: number, height: number) =>
    width / BOX_WIDTH > 0.075 && height / BOX_HEIGHT > 0.09;
</script>

{#if tiles.length === 0}
  <p class="text-muted text-sm">No file scored above zero in this window.</p>
{:else}
  <div
    class="border-line bg-bg relative aspect-[16/9] w-full overflow-hidden rounded-lg border"
  >
    {#each tiles as tile (tile.item.path)}
      {@const row = tile.item}
      {@const level = heatLevel(scale, row.complexity)}
      <button
        type="button"
        class="absolute overflow-hidden p-1.5 text-left transition-[filter] outline-none
               hover:brightness-115 focus-visible:z-10 focus-visible:brightness-115
               {selected === row.path
          ? 'ring-ink z-10 ring-2 ring-inset'
          : 'ring-bg/60 ring-1 ring-inset'}"
        style="left: {percent(tile.x, BOX_WIDTH)};
               top: {percent(tile.y, BOX_HEIGHT)};
               width: {percent(tile.width, BOX_WIDTH)};
               height: {percent(tile.height, BOX_HEIGHT)};
               background: {heatColor(level)};
               color: {heatInk(level)};"
        aria-pressed={selected === row.path}
        title="{row.path} — score {compactNumber(row.score)}, {row.churn} commits, complexity {compactNumber(
          row.complexity,
        )}"
        onclick={() => onselect?.(row.path)}
      >
        {#if fits(tile.width, tile.height)}
          <span class="block truncate text-[11px] leading-tight font-medium">
            {fileName(row.path)}
          </span>
          <span class="block truncate font-mono text-[10px] opacity-80">
            {compactNumber(row.score)}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  {#if rows.length > shown.length}
    <p class="text-subtle mt-2 text-xs">
      Showing the top {shown.length} of {rows.length} scored files.
    </p>
  {/if}
{/if}
