<script lang="ts">
  import type { RunPlugin } from './run-plugins';

  /**
   * Who takes part in the next run: a chip each, and a line for every plugin
   * that is loaded but stands by. Dimming a chip would leave the reason to be
   * guessed, and "why is my convention plugin doing nothing" is exactly the
   * question this screen exists to answer.
   */

  interface Props {
    entries: readonly RunPlugin[];
    /** True while the first `/plugins` response is still on the way. */
    loading?: boolean;
    /** Why the list is empty, when the server said so. */
    error?: string;
  }

  let { entries, loading = false, error = '' }: Props = $props();

  let running = $derived(entries.filter((entry) => entry.runs));
  let standby = $derived(entries.filter((entry) => !entry.runs));
</script>

{#if error}
  <p class="text-warn text-sm">{error}</p>
{:else if loading && entries.length === 0}
  <p class="text-muted text-sm">Loading plugins…</p>
{:else if entries.length === 0}
  <p class="text-muted text-sm">
    No plugins loaded — a run over this project would find nothing.
  </p>
{:else}
  {#if running.length === 0}
    <p class="text-warn text-sm">
      Nothing loaded takes part in a run: what is installed cannot analyse a
      repository.
    </p>
  {:else}
    <ul class="flex flex-wrap gap-2">
      {#each running as entry (entry.id)}
        <li
          class="border-line bg-elevated flex items-baseline gap-2 rounded-md border px-2 py-1"
          title={entry.id}
        >
          <span class="text-sm">{entry.name}</span>
          <span class="text-subtle font-mono text-[0.6875rem]">
            {entry.kind}
          </span>
          {#if entry.source === 'user'}
            <span class="text-accent text-[0.6875rem]">user</span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if standby.length > 0}
    <ul class="mt-3 space-y-1">
      {#each standby as entry (entry.id)}
        <li class="text-subtle text-xs">
          <span class="text-muted">{entry.name}</span>
          stands by — {entry.note}
        </li>
      {/each}
    </ul>
  {/if}
{/if}
