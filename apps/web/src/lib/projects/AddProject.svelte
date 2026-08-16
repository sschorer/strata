<script lang="ts">
  import type { AddProjectRequest } from '$lib/api';
  import { ApiError } from '$lib/api';
  import FolderPicker from './FolderPicker.svelte';
  import { projectLabel } from './label';

  interface Props {
    /** Registers the project; rejects with what the server said. */
    onadd: (input: AddProjectRequest) => Promise<unknown>;
    oncancel: () => void;
  }

  let { onadd, oncancel }: Props = $props();

  let root = $state('');
  let name = $state('');
  let busy = $state(false);
  let error = $state('');
  // Browsing is the way in for anyone who does not know the path by heart;
  // the field stays, because pasting one is faster when you do.
  let browsing = $state(false);

  // The path is the only thing a reader has to type: a repository is called
  // after its folder until they say otherwise.
  let suggested = $derived(projectLabel(root));

  async function submit(): Promise<void> {
    const path = root.trim();
    if (!path) {
      error = 'Enter the absolute path of a repository.';
      return;
    }

    busy = true;
    error = '';
    try {
      await onadd({ name: name.trim() || suggested, root: path });
    } catch (err) {
      // The server owns the rules — not a repository, root already registered
      // — so its message is the one worth showing.
      error =
        err instanceof ApiError ? err.message : 'Unexpected client error.';
    } finally {
      busy = false;
    }
  }
</script>

<form
  class="space-y-3"
  onsubmit={(event) => {
    event.preventDefault();
    void submit();
  }}
>
  <div>
    <div class="mb-1 flex items-baseline justify-between gap-2">
      <span class="text-subtle text-xs" id="add-project-root">
        Repository path
      </span>
      <button
        type="button"
        class="text-accent hover:underline text-[0.6875rem] underline-offset-2"
        aria-expanded={browsing}
        onclick={() => (browsing = !browsing)}
      >
        {browsing ? 'Hide browser' : 'Browse…'}
      </button>
    </div>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-md border px-2 py-1.5 font-mono text-xs"
      type="text"
      name="root"
      aria-labelledby="add-project-root"
      autocomplete="off"
      autofocus
      spellcheck="false"
      placeholder="/absolute/path/to/repo"
      bind:value={root}
    />
  </div>

  {#if browsing}
    <FolderPicker
      initial={root.trim() || undefined}
      onpick={(path) => {
        root = path;
        browsing = false;
      }}
    />
  {/if}

  <label class="block">
    <span class="text-subtle mb-1 block text-xs">Display name</span>
    <input
      class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-md border px-2 py-1.5 text-sm"
      type="text"
      name="name"
      autocomplete="off"
      placeholder={suggested || 'The folder name'}
      bind:value={name}
    />
  </label>

  {#if error}
    <p class="text-danger text-xs">{error}</p>
  {/if}

  <div class="flex items-center gap-2">
    <button
      type="submit"
      class="bg-accent text-accent-ink hover:bg-accent-strong rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
      disabled={busy}
    >
      {busy ? 'Adding…' : 'Add project'}
    </button>
    <button
      type="button"
      class="text-muted hover:bg-elevated rounded-md px-3 py-1.5 text-xs transition-colors"
      onclick={oncancel}
    >
      Cancel
    </button>
  </div>

  <p class="text-subtle text-[0.6875rem]">
    The path is read on the machine running the server; any folder inside the
    repository will do.
  </p>
</form>
