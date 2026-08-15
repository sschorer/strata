<script lang="ts">
  import type { FolderRow } from './rows';

  interface Props {
    rows: FolderRow[];
    ontoggle?: (path: string) => void;
    onall?: (collapse: boolean) => void;
  }

  let { rows, ontoggle, onall }: Props = $props();

  let open = $derived(rows.filter((row) => row.open).length);
</script>

<div class="mb-3 flex items-center justify-between gap-3">
  <p class="text-subtle text-xs">{open} of {rows.length} open</p>
  <div class="flex gap-1">
    <button
      type="button"
      class="border-line text-muted hover:text-ink rounded-md border px-2 py-1 text-xs"
      onclick={() => onall?.(true)}
    >
      Close all
    </button>
    <button
      type="button"
      class="border-line text-muted hover:text-ink rounded-md border px-2 py-1 text-xs"
      onclick={() => onall?.(false)}
    >
      Open all
    </button>
  </div>
</div>

<ul class="flex max-h-80 flex-col overflow-y-auto">
  {#each rows as row (row.path)}
    <li>
      <button
        type="button"
        class="hover:bg-elevated flex w-full items-baseline gap-2 rounded-md py-1.5 pr-2 text-left"
        style="padding-left: {row.depth * 0.85 + 0.5}rem"
        aria-pressed={row.open}
        onclick={() => ontoggle?.(row.path)}
      >
        <span class="text-subtle w-3 font-mono text-xs" aria-hidden="true">
          {row.open ? '▾' : '▸'}
        </span>
        <span class="flex-1 truncate font-mono text-xs" title={row.path}>
          {row.name}
        </span>
        {#if row.knotted}
          <span class="text-danger text-xs" title="Contains an import cycle">
            ⟳
          </span>
        {/if}
        <span class="text-subtle font-mono text-xs">{row.files}</span>
      </button>
    </li>
  {/each}
</ul>
