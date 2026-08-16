<script lang="ts">
  import type { ProjectEntry } from './entries';

  interface Props {
    entries: readonly ProjectEntry[];
    /** Id of the project the workbench is on, if any. */
    selected: string | null;
    onselect: (id: string) => void;
    onremove: (id: string) => void;
  }

  let { entries, selected, onselect, onremove }: Props = $props();

  /**
   * Removing is one click away from switching, and it is the one action here
   * that cannot be undone from this dropdown — so the row asks first. Only one
   * row can be asking at a time.
   */
  let asking = $state<string | null>(null);

  // A list that changed under the question: the answer would apply to a row
  // that may no longer be there.
  $effect(() => {
    if (asking && !entries.some((entry) => entry.id === asking)) asking = null;
  });
</script>

{#if entries.length === 0}
  <p class="text-muted px-2 py-3 text-sm">No projects registered yet.</p>
{:else}
  <ul class="max-h-64 space-y-0.5 overflow-y-auto" aria-label="Projects">
    {#each entries as entry (entry.id)}
      <li>
        <div class="flex items-start gap-1">
          <button
            type="button"
            class="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left transition-colors
                   {entry.id === selected
              ? 'bg-accent-soft text-ink'
              : 'hover:bg-elevated'}"
            aria-current={entry.id === selected ? 'true' : undefined}
            onclick={() => onselect(entry.id)}
          >
            <span class="block truncate text-sm font-medium">{entry.name}</span>
            <span
              class="text-subtle block truncate font-mono text-[0.6875rem]"
              title={entry.root}
            >
              {entry.root}
            </span>
            <span class="text-subtle block text-[0.6875rem]">
              {#if entry.analysed}
                {entry.files} files · {entry.age}
              {:else}
                {entry.age}
              {/if}
            </span>
          </button>

          {#if asking !== entry.id}
            <button
              type="button"
              class="text-subtle hover:bg-elevated hover:text-danger shrink-0 rounded-md px-2 py-1.5 text-sm transition-colors"
              aria-label="Remove {entry.name}"
              title="Remove {entry.name} from Strata"
              onclick={() => (asking = entry.id)}
            >
              ×
            </button>
          {/if}
        </div>

        {#if asking === entry.id}
          <div class="flex items-center gap-2 px-2 pt-1 pb-2">
            <p class="text-subtle flex-1 text-[0.6875rem]">
              Remove from Strata? The repository stays on disk.
            </p>
            <button
              type="button"
              class="text-danger hover:bg-elevated rounded-md px-2 py-1 text-xs font-medium transition-colors"
              onclick={() => {
                asking = null;
                onremove(entry.id);
              }}
            >
              Remove
            </button>
            <button
              type="button"
              class="text-muted hover:bg-elevated rounded-md px-2 py-1 text-xs transition-colors"
              onclick={() => (asking = null)}
            >
              Cancel
            </button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
