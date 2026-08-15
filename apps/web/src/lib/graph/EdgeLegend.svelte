<script lang="ts">
  import { edgeDash, edgeStroke, edgeWidth, type EdgeClass } from './edges';

  interface Props {
    /** Which kinds of edge the drawing actually has. */
    present?: ReadonlySet<EdgeClass>;
  }

  let { present }: Props = $props();

  const entries: { edgeClass: EdgeClass; label: string }[] = [
    { edgeClass: 'local', label: 'local import' },
    { edgeClass: 'package', label: 'package' },
    { edgeClass: 'cycle', label: 'in a cycle' },
  ];

  // Naming a style the reader cannot find on screen sends them looking for it.
  let shown = $derived(
    entries.filter((entry) => present?.has(entry.edgeClass) ?? true),
  );
</script>

<ul class="flex flex-wrap items-center gap-x-5 gap-y-2">
  {#each shown as entry (entry.edgeClass)}
    <li class="flex items-center gap-2">
      <svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true">
        <line
          x1="0"
          y1="4"
          x2="28"
          y2="4"
          stroke={edgeStroke(entry.edgeClass)}
          stroke-width={edgeWidth(entry.edgeClass) * 1.5}
          stroke-dasharray={edgeDash(entry.edgeClass)}
        />
      </svg>
      <span class="text-subtle text-xs">{entry.label}</span>
    </li>
  {/each}
</ul>
