<script lang="ts">
  import { ApiError } from '$lib/api';
  import Card from '$lib/components/Card.svelte';
  import { projects as registry, type ProjectsStore } from '$lib/projects';
  import {
    projectConfig as store,
    type ProjectConfigStore,
  } from './config.svelte';
  import {
    checkGeneral,
    generalChanged,
    generalForm,
    NAME_MAX,
    type GeneralForm,
  } from './general';

  /**
   * *Project settings → General*: what the open project is called, where it is
   * mounted, and the window an analysis of it reads.
   *
   * The four values live in two places — the name is the registry entry, the
   * revision and the history limit are the project's config — so a save is two
   * requests, and only for the half that changed. The reader is told about one
   * screen, not about that split.
   */

  interface Props {
    /** The registry. Defaults to the app's, as the switcher's does. */
    projects?: ProjectsStore;
    /** The open project's config. Defaults to the app's. */
    config?: ProjectConfigStore;
  }

  let { projects = registry, config = store }: Props = $props();

  let form = $state<GeneralForm>({ name: '', rev: '', historyLimit: '' });
  let busy = $state(false);
  let error = $state('');
  let notice = $state('');

  // Mounted without the frame — in a test, or on a direct load — the screen
  // still finds the project it is scoped to, and its config.
  $effect(() => {
    projects.load();
  });

  let project = $derived(projects.current);

  $effect(() => {
    if (project) config.load(project.id);
  });

  // Only the config that belongs to the open project: the workbench can be
  // pointed elsewhere while this screen is up, and a revision read under one
  // project must never be saved under another.
  let stored = $derived(
    project && config.config && config.projectId === project.id
      ? config.config
      : null,
  );
  let saved = $derived(project && stored ? generalForm(project, stored) : null);
  let dirty = $derived(saved !== null && generalChanged(form, saved));
  // An error belongs to the project it was raised for: switching project asks
  // again, and the old failure must not be what the new one is described by.
  let failed = $derived(
    config.status === 'error' && config.projectId === project?.id,
  );

  // Seed the fields from what is stored, and re-seed whenever that changes
  // underneath — a save included, so the form shows what the server kept
  // rather than what was typed at it.
  $effect(() => {
    if (saved) form = { ...saved };
  });

  // Any edit retires the last save's confirmation; it described the values
  // that were sent, and those are no longer what is on screen.
  $effect(() => {
    if (dirty) notice = '';
  });

  async function submit(): Promise<void> {
    if (!project || !saved) return;

    const check = checkGeneral(form, saved);
    if (!check.ok) {
      error = check.error;
      notice = '';
      return;
    }

    const { identity, config: patch } = check.patch;
    if (!identity && !patch) {
      error = '';
      return;
    }

    busy = true;
    error = '';
    try {
      // Identity first: it is the half the rail and the switcher show, so a
      // config write that fails still leaves a screen whose heading is right.
      if (identity) await projects.update(project.id, identity);
      if (patch) await config.save(project.id, patch);
      notice = 'Saved.';
    } catch (err) {
      // The server owns the rules — a name already taken, a revision it cannot
      // store — so its message is the one worth showing.
      error = err instanceof ApiError ? err.message : 'Unexpected client error.';
      notice = '';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>General · Project settings · Strata</title>
</svelte:head>

<div class="max-w-3xl">
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">General</h1>
    <p class="text-muted mt-1 text-sm">
      What this project is called, where it is mounted, and the slice of history
      every analysis of it reads.
    </p>
  </header>

  {#if !project}
    <p class="text-muted text-sm">
      These settings belong to one repository — pick a project in the switcher,
      or add one, first.
    </p>
  {:else if failed}
    {@const id = project.id}
    <p class="text-danger text-sm">{config.error}</p>
    <button
      type="button"
      class="border-line bg-surface hover:bg-elevated mt-3 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
      onclick={() => void config.reload(id)}
    >
      Try again
    </button>
  {:else if !saved}
    <p class="text-muted text-sm">Reading this project's settings…</p>
  {:else}
    <form
      class="space-y-6"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Card title="Identity" hint="registered project">
        <div class="space-y-4">
          <label class="block">
            <span class="text-subtle mb-1 block text-xs">Display name</span>
            <input
              class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-md border px-2 py-1.5 text-sm"
              type="text"
              name="name"
              autocomplete="off"
              maxlength={NAME_MAX}
              bind:value={form.name}
            />
            <span class="text-subtle mt-1 block text-[0.6875rem]">
              What the switcher, the breadcrumb and this heading call the
              project. It renames nothing on disk.
            </span>
          </label>

          <div>
            <span class="text-subtle mb-1 block text-xs" id="general-root">
              Repository root
            </span>
            <input
              class="border-line bg-elevated text-muted w-full cursor-default rounded-md border px-2 py-1.5 font-mono text-xs"
              type="text"
              name="root"
              aria-labelledby="general-root"
              readonly
              spellcheck="false"
              value={project.root}
            />
            <span class="text-subtle mt-1 block text-[0.6875rem]">
              Where the working tree sits on the machine running the server —
              the mount Strata reads, and only ever reads. To point Strata at a
              different path, remove the project and add it again.
            </span>
          </div>
        </div>
      </Card>

      <Card title="Analysis window" hint="every run over this project">
        <div class="space-y-4">
          <label class="block">
            <span class="text-subtle mb-1 block text-xs">Revision</span>
            <input
              class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-md border px-2 py-1.5 font-mono text-xs"
              type="text"
              name="rev"
              autocomplete="off"
              spellcheck="false"
              placeholder="HEAD"
              bind:value={form.rev}
            />
            <span class="text-subtle mt-1 block text-[0.6875rem]">
              A branch, tag or commit sha. <code class="font-mono">HEAD</code>
              follows whatever is checked out in the working tree.
            </span>
          </label>

          <label class="block">
            <span class="text-subtle mb-1 block text-xs">History limit</span>
            <input
              class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-md border px-2 py-1.5 font-mono text-xs sm:w-48"
              type="text"
              name="historyLimit"
              inputmode="numeric"
              autocomplete="off"
              placeholder="Whole history"
              bind:value={form.historyLimit}
            />
            <span class="text-subtle mt-1 block text-[0.6875rem]">
              How many commits back churn and the commit analytics are read.
              Leave it blank for the whole history; a cap keeps a first run over
              a long-lived repository short.
            </span>
          </label>
        </div>
      </Card>

      {#if error}
        <p class="text-danger text-sm" role="alert">{error}</p>
      {/if}

      <div class="flex items-center gap-3">
        <button
          type="submit"
          class="bg-accent text-accent-ink hover:bg-accent-strong rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
          disabled={busy || !dirty}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          class="text-muted hover:bg-elevated rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-60"
          disabled={busy || !dirty}
          onclick={() => {
            if (saved) form = { ...saved };
            error = '';
          }}
        >
          Discard
        </button>
        {#if notice}
          <p class="text-ok text-xs" role="status">{notice}</p>
        {/if}
      </div>

      <p class="text-subtle text-[0.6875rem]">
        The revision and the limit are what a run uses unless the request names
        its own — <em>Re-analyze</em> and a headless run both read them.
      </p>
    </form>
  {/if}
</div>
