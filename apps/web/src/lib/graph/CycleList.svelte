<script lang="ts">
  import { fileName } from '$lib/format';
  import type { CycleView } from './cycles';

  interface Props {
    cycles: CycleView[];
    /** The cycle whose nodes the canvas is lighting up, by `index`. */
    selected?: number | null;
    onselect?: (index: number) => void;
  }

  let { cycles, selected = null, onselect }: Props = $props();

  /** `a → b → a`, on file names; the full paths stay in the tooltip. */
  const arrow = (path: readonly string[]) => path.map(fileName).join(' → ');
</script>

{#if cycles.length === 0}
  <p class="text-muted text-sm">
    No import cycles — every dependency in this report runs one way.
  </p>
{:else}
  <ul class="flex flex-col gap-1">
    {#each cycles as cycle (cycle.index)}
      <li>
        <button
          type="button"
          class="hover:bg-elevated w-full rounded-lg px-2 py-2 text-left
                 {selected === cycle.index ? 'bg-accent-soft' : ''}"
          aria-pressed={selected === cycle.index}
          title={cycle.path.join(' → ')}
          onclick={() => onselect?.(cycle.index)}
        >
          <span class="flex items-baseline justify-between gap-3">
            <span class="text-danger font-mono text-xs">#{cycle.index}</span>
            <span class="text-subtle text-xs">
              {cycle.members.length} files
            </span>
          </span>
          <span class="text-ink mt-1 block font-mono text-xs break-all">
            {arrow(cycle.path)}
          </span>
        </button>
      </li>
    {/each}
  </ul>
{/if}
