<script lang="ts">
  import { untrack } from 'svelte';
  import {
    ApiError,
    browseDirectory,
    type DirectoryListing,
  } from '$lib/api';
  import { pathCrumbs } from './crumbs';

  /**
   * Click through the folders on the machine running the server and pick the
   * one to register. Repositories are marked, so the tree reads as *where my
   * projects are* rather than as a file dialog.
   *
   * The server decides what is reachable (its browse roots); this only ever
   * asks for a path it was itself handed.
   */

  interface Props {
    /** Where to open. Defaults to the server's first browse root. */
    initial?: string;
    /** Called with the absolute path of the folder that was chosen. */
    onpick: (path: string) => void;
  }

  let { initial, onpick }: Props = $props();

  let listing = $state<DirectoryListing | null>(null);
  let loading = $state(true);
  let error = $state('');
  let hidden = $state(false);

  let crumbs = $derived(
    listing ? pathCrumbs(listing.path, listing.roots) : [],
  );

  async function open(path?: string): Promise<void> {
    loading = true;
    error = '';
    try {
      listing = await browseDirectory({ path, hidden });
    } catch (err) {
      error =
        err instanceof ApiError ? err.message : 'Unexpected client error.';
    } finally {
      loading = false;
    }
  }

  // First look, and again whenever the dot-directory toggle changes. Where we
  // are is read untracked: `open` writes `listing`, so tracking it here would
  // make every listing ask for another one.
  $effect(() => {
    void hidden;
    void open(untrack(() => listing?.path ?? initial));
  });
</script>

<div class="border-line rounded-md border">
  <div class="border-line flex items-center gap-1 border-b px-2 py-1.5">
    <button
      type="button"
      class="text-subtle hover:bg-elevated hover:text-ink shrink-0 rounded px-1.5 py-0.5 text-xs transition-colors disabled:opacity-40"
      disabled={!listing?.parent || loading}
      title="Up one folder"
      aria-label="Up one folder"
      onclick={() => void open(listing?.parent ?? undefined)}
    >
      ↑
    </button>
    <!-- The path as steps back: the reader can jump out of a deep tree in one
         click, and never above a browse root. -->
    <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Path">
      {#each crumbs as crumb, index (crumb.path)}
        {#if index > 0}
          <span class="text-subtle shrink-0 text-[0.6875rem]" aria-hidden="true">/</span>
        {/if}
        <button
          type="button"
          class="hover:bg-elevated shrink-0 rounded px-1 py-0.5 font-mono text-[0.6875rem] transition-colors
                 {index === crumbs.length - 1 ? 'text-ink' : 'text-subtle'}"
          aria-current={index === crumbs.length - 1 ? 'location' : undefined}
          onclick={() => void open(crumb.path)}
        >
          {crumb.label}
        </button>
      {/each}
    </nav>
  </div>

  {#if listing && listing.roots.length > 1}
    <!-- More than one place to browse from: name them, because their paths
         have nothing in common and a breadcrumb cannot show the others. -->
    <div class="border-line flex flex-wrap gap-1 border-b px-2 py-1.5">
      {#each listing.roots as root (root)}
        <button
          type="button"
          class="border-line hover:bg-elevated rounded border px-1.5 py-0.5 font-mono text-[0.625rem] transition-colors"
          onclick={() => void open(root)}
        >
          {root}
        </button>
      {/each}
    </div>
  {/if}

  <div class="max-h-56 overflow-y-auto p-1">
    {#if loading && !listing}
      <p class="text-subtle px-2 py-3 text-xs">Reading the folder…</p>
    {:else if error}
      <p class="text-danger px-2 py-3 text-xs">{error}</p>
      {#if listing?.roots[0]}
        <button
          type="button"
          class="text-accent hover:bg-elevated w-full rounded px-2 py-1 text-left text-xs"
          onclick={() => void open(listing?.roots[0])}
        >
          Back to {listing.roots[0]}
        </button>
      {/if}
    {:else if listing && listing.roots.length === 0}
      <p class="text-muted px-2 py-3 text-xs">
        This server reaches nothing. Set <code class="font-mono">STRATA_ROOTS</code
        > to the directory your repositories live in — it is also what may be
        registered and analysed.
      </p>
    {:else if listing && listing.entries.length === 0}
      <p class="text-subtle px-2 py-3 text-xs">No folders in here.</p>
    {:else if listing}
      <ul aria-label="Folders">
        {#each listing.entries as entry (entry.path)}
          <li class="flex items-center gap-1">
            <button
              type="button"
              class="hover:bg-elevated flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors"
              onclick={() => void open(entry.path)}
            >
              <span class="text-subtle shrink-0" aria-hidden="true">
                {entry.repo ? '◆' : '▸'}
              </span>
              <span class="truncate">{entry.name}</span>
              {#if entry.repo}
                <span
                  class="text-accent border-line ml-auto shrink-0 rounded border px-1 text-[0.5625rem] tracking-wide uppercase"
                >
                  repo
                </span>
              {/if}
            </button>
            {#if entry.repo}
              <!-- A repository is what the reader came for: selectable without
                   stepping into it first. -->
              <button
                type="button"
                class="text-accent hover:bg-elevated shrink-0 rounded px-1.5 py-1 text-[0.6875rem] font-medium transition-colors"
                onclick={() => onpick(entry.path)}
              >
                Select
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="border-line flex items-center gap-2 border-t px-2 py-1.5">
    <button
      type="button"
      class="bg-accent text-accent-ink hover:bg-accent-strong rounded px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50"
      disabled={!listing?.path}
      onclick={() => listing && onpick(listing.path)}
    >
      Use this folder
    </button>
    <label class="text-subtle ml-auto flex items-center gap-1 text-[0.6875rem]">
      <input type="checkbox" class="accent-accent" bind:checked={hidden} />
      Hidden
    </label>
  </div>
</div>
