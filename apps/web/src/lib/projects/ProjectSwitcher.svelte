<script lang="ts">
  import { untrack } from 'svelte';
  import { analysis } from '$lib/analysis';
  import AddProject from './AddProject.svelte';
  import ProjectList from './ProjectList.svelte';
  import { projectEntries } from './entries';
  import { projects as registry, type ProjectsStore } from './store.svelte';

  /**
   * The project the workbench is pointed at, and the way to change it: the
   * registered projects with what the last run over each one found, *Add
   * project*, and a removal that only ever touches the registry.
   */

  interface Props {
    /**
     * The registry. Defaults to the app's — the rail and the narrow-screen
     * header both mount a switcher and they show the same one project.
     */
    projects?: ProjectsStore;
  }

  let { projects = registry }: Props = $props();

  let open = $state(false);
  let adding = $state(false);
  let failure = $state('');
  let slot = $state<HTMLElement | null>(null);
  let now = $state(Date.now());

  // The switcher is on screen for the whole session, so this is where the
  // registry gets loaded — once, whatever screen the reader opened on.
  $effect(() => {
    projects.load();
  });

  // The server records every run over a registered root against the registry.
  // Folding the same summary in here keeps the ages in the list honest without
  // a second round-trip; untracked, because it writes the list it reads.
  $effect(() => {
    const report = analysis.report;
    if (report) untrack(() => projects.record(report));
  });

  // "3 min ago" has to keep counting while the dropdown sits open.
  $effect(() => {
    if (!open) return;
    now = Date.now();
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  let current = $derived(projects.current);
  let entries = $derived(projectEntries(projects.projects, now));
  // Registered but never analysed — the state *Add project* leaves behind.
  let unanalysed = $derived(current !== null && current.lastAnalysis === null);

  function close(): void {
    open = false;
    adding = false;
    failure = '';
  }

  function select(id: string): void {
    failure = '';
    projects.select(id);
    // Nothing left to choose; the reader is on the project they picked.
    if (!unanalysed) close();
  }

  async function remove(id: string): Promise<void> {
    failure = '';
    try {
      await projects.remove(id);
    } catch (err) {
      failure = err instanceof Error ? err.message : 'Could not remove it.';
    }
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape') close();
  }}
  onpointerdown={(event) => {
    if (open && slot && !slot.contains(event.target as Node)) close();
  }}
/>

<div class="relative" bind:this={slot}>
  <button
    type="button"
    class="border-line bg-elevated hover:border-line-strong flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors"
    aria-expanded={open}
    aria-haspopup="true"
    aria-label="Current project"
    onclick={() => (open ? close() : (open = true))}
  >
    <span class="min-w-0 flex-1">
      <span class="text-subtle block text-[0.625rem] tracking-wide uppercase">
        Project
      </span>
      {#if current}
        <span class="block truncate text-sm font-medium">{current.name}</span>
        <span
          class="text-subtle block truncate font-mono text-[0.6875rem]"
          title={current.root}
        >
          {current.root}
        </span>
      {:else}
        <span class="text-muted block text-sm">No project selected</span>
        <span class="text-subtle block text-[0.6875rem]">
          Choose one, or add a repository.
        </span>
      {/if}
    </span>
    <svg
      class="text-subtle shrink-0"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  {#if open}
    <!-- Adding widens the panel past the rail: a folder tree in a 240px
         column is a column of ellipses. -->
    <div
      class="border-line bg-surface shadow-card absolute z-30 mt-1 rounded-lg border p-2
             {adding ? 'w-[22rem] max-w-[calc(100vw-2rem)]' : 'w-full'}"
    >
      {#if adding}
        <AddProject
          onadd={async (input) => {
            await projects.add(input);
            adding = false;
          }}
          oncancel={() => (adding = false)}
        />
      {:else}
        {#if projects.status === 'error'}
          <p class="text-danger px-2 py-3 text-sm">{projects.error}</p>
        {:else if projects.status === 'loading'}
          <p class="text-subtle px-2 py-3 text-sm">Loading projects…</p>
        {:else}
          <ProjectList
            {entries}
            selected={current?.id ?? null}
            onselect={select}
            onremove={(id) => void remove(id)}
          />
        {/if}

        {#if failure}
          <p class="text-danger px-2 pb-2 text-xs">{failure}</p>
        {/if}

        <div class="border-line mt-1 border-t pt-2">
          <button
            type="button"
            class="text-accent hover:bg-elevated w-full rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
            onclick={() => {
              adding = true;
              failure = '';
            }}
          >
            + Add project
          </button>
        </div>

        {#if unanalysed}
          <!--
            A project that has never been analysed has nothing to show on any
            screen, so the switcher offers the first run itself. *Project
            settings → Analyze / run* is where this belongs once that screen
            exists; until then this is the shortest way out of an empty
            workbench.
          -->
          <div class="border-line mt-1 border-t pt-2">
            <p class="text-subtle px-2 pb-1.5 text-[0.6875rem]">
              {current?.name} has not been analysed yet.
            </p>
            <button
              type="button"
              class="bg-accent text-accent-ink hover:bg-accent-strong w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
              disabled={analysis.status === 'running'}
              onclick={() => {
                void analysis.run();
                close();
              }}
            >
              {analysis.status === 'running'
                ? 'Analysing…'
                : 'Run first analysis'}
            </button>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
