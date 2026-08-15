<script lang="ts">
  import { compactNumber, dirName, fileName } from '$lib/format';
  import { heatColor, heatLevel, type HeatScale } from './heat';
  import type { HotspotRow } from './rows';

  interface Props {
    rows: HotspotRow[];
    scale: HeatScale;
    /** Rows rendered; the tail of a long ranking is noise. */
    limit?: number;
    selected?: string | null;
    onselect?: (path: string) => void;
  }

  let { rows, scale, limit = 100, selected = null, onselect }: Props = $props();

  let shown = $derived(rows.slice(0, limit));
</script>

<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <caption class="sr-only">
      Files ranked by hotspot score: churn × complexity
    </caption>
    <thead>
      <tr class="border-line text-subtle border-b text-xs">
        <th scope="col" class="w-10 py-2 pr-3 text-right font-medium">#</th>
        <th scope="col" class="py-2 pr-3 text-left font-medium">File</th>
        <th scope="col" class="w-20 py-2 pr-3 text-right font-medium">Churn</th>
        <th scope="col" class="w-24 py-2 pr-3 text-right font-medium">
          Complexity
        </th>
        <th scope="col" class="w-20 py-2 pr-3 text-right font-medium">LOC</th>
        <th scope="col" class="w-20 py-2 text-right font-medium">Score</th>
      </tr>
    </thead>
    <tbody>
      {#each shown as row, index (row.path)}
        <tr
          class="border-line hover:bg-elevated border-b last:border-b-0
                 {selected === row.path ? 'bg-accent-soft' : ''}"
        >
          <td class="text-subtle py-2 pr-3 text-right font-mono text-xs">
            {index + 1}
          </td>
          <td class="max-w-0 py-2 pr-3">
            <!-- The name is the control: a clickable <tr> would be neither
                 focusable nor announced. -->
            <button
              type="button"
              class="flex w-full items-center gap-2 text-left"
              aria-pressed={selected === row.path}
              onclick={() => onselect?.(row.path)}
            >
              <span
                class="size-2.5 shrink-0 rounded-xs"
                style="background: {heatColor(heatLevel(scale, row.complexity))};"
                aria-hidden="true"
              ></span>
              <span class="truncate font-mono text-xs" title={row.path}>
                <span class="text-subtle">{dirName(row.path)}</span
                ><span class="text-ink">{fileName(row.path)}</span>
              </span>
            </button>
          </td>
          <td class="text-muted py-2 pr-3 text-right font-mono text-xs">
            {row.churn}
          </td>
          <td class="text-muted py-2 pr-3 text-right font-mono text-xs">
            {compactNumber(row.complexity)}
          </td>
          <td class="text-muted py-2 pr-3 text-right font-mono text-xs">
            {row.loc === null ? '—' : compactNumber(row.loc)}
          </td>
          <td class="py-2 text-right font-mono text-xs font-medium">
            {compactNumber(row.score)}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{#if rows.length > shown.length}
  <p class="text-subtle mt-3 text-xs">
    {shown.length} of {rows.length} scored files.
  </p>
{/if}
