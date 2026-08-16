<script lang="ts">
  import { fileName } from '$lib/format';
  import type { CycleView } from '$lib/graph';

  interface Props {
    cycles: CycleView[];
    /** Knots printed here; the rest are on the dependency screen. */
    limit?: number;
  }

  let { cycles, limit = 3 }: Props = $props();

  let shown = $derived(cycles.slice(0, limit));

  /** `a → b → a`, on file names; the full paths stay in the tooltip. */
  const arrow = (path: readonly string[]) => path.map(fileName).join(' → ');
</script>

{#if cycles.length === 0}
  <p class="text-muted text-sm">
    No import cycles — every dependency in this report runs one way.
  </p>
{:else}
  <!-- The alert says what is wrong in words as well as in red: a colour is not
       the finding, the cycle path is. -->
  <p class="text-danger text-sm font-medium">
    {cycles.length}
    {cycles.length === 1 ? 'import cycle' : 'import cycles'} — files that import
    each other, directly or around a loop.
  </p>

  <ul class="mt-3 flex flex-col gap-2">
    {#each shown as cycle (cycle.index)}
      <li
        class="border-line bg-elevated rounded-lg border p-2"
        title={cycle.path.join(' → ')}
      >
        <span class="flex items-baseline justify-between gap-3">
          <span class="text-danger font-mono text-xs">#{cycle.index}</span>
          <span class="text-subtle text-xs">{cycle.members.length} files</span>
        </span>
        <span class="text-ink mt-1 block font-mono text-xs break-all">
          {arrow(cycle.path)}
        </span>
      </li>
    {/each}
  </ul>

  <p class="mt-3 text-xs">
    <a class="text-accent underline-offset-4 hover:underline" href="/graph">
      {cycles.length > shown.length
        ? `All ${cycles.length} on the dependency graph →`
        : 'Open the dependency graph →'}
    </a>
  </p>
{/if}
