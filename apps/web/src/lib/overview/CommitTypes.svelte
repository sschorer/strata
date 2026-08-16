<script lang="ts">
  import type { CommitTypeRow } from './commits';

  interface Props {
    types: CommitTypeRow[];
    /** Types listed before the tail becomes the commit screen's job. */
    limit?: number;
  }

  let { types, limit = 6 }: Props = $props();

  let shown = $derived(types.slice(0, limit));

  const width = (share: number) => `${(share * 100).toFixed(1)}%`;
  const percent = (share: number) => `${Math.round(share * 100)}%`;
</script>

{#if shown.length === 0}
  <p class="text-muted text-sm">
    No commits in the analysed history window.
  </p>
{:else}
  <!--
    One bar per type rather than one strip in six colours: the palette here is
    a heat ramp — a *sequential* scale — and the app has no categorical set to
    tell six change types apart. Colouring them from the ramp anyway would pair
    hues no reader can separate (and no colour-blind reader can separate at
    all), and would say "hotter = worse" about `docs`. So identity is the label
    and magnitude is the bar, which is what the two facts actually are.
  -->
  <ul class="flex flex-col gap-3">
    {#each shown as row (row.type)}
      <li>
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-ink truncate font-mono text-xs">{row.type}</span>
          <span class="shrink-0 font-mono text-xs">
            {#if row.breaking > 0}
              <span class="text-danger">{row.breaking} breaking</span>
              <span class="text-subtle">·</span>
            {/if}
            <span class="text-muted">{row.count}</span>
            <span class="text-subtle">{percent(row.share)}</span>
          </span>
        </div>
        <div
          class="bg-elevated mt-1 h-1.5 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            class="bg-accent h-full rounded-full"
            style="width: {width(row.share)};"
          ></div>
        </div>
      </li>
    {/each}
  </ul>

  {#if types.length > shown.length}
    <p class="text-subtle mt-3 text-xs">
      {shown.length} of {types.length} change types.
    </p>
  {/if}
{/if}
