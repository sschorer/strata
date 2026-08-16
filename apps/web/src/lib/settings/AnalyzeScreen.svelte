<script lang="ts">
  import { untrack } from 'svelte';
  import { analysis } from '$lib/analysis';
  import type { ProjectAnalysis } from '$lib/api';
  import Card from '$lib/components/Card.svelte';
  import { plugins as loaded, type PluginsStore } from '$lib/plugins';
  import { projects as registry, type ProjectsStore } from '$lib/projects';
  import RecentRuns from './RecentRuns.svelte';
  import RunPlugins from './RunPlugins.svelte';
  import {
    projectConfig as store,
    type ProjectConfigStore,
  } from './config.svelte';
  import { mergeRun, runEntry } from './recents';
  import { readRecents, storeRecents } from './recents-storage';
  import { runPlugins } from './run-plugins';
  import { runWindow } from './run-window';

  /**
   * *Project settings → Analyze / run*: what a run over this project will
   * read, who takes part in it, the button that starts it, and what the last
   * few runs found.
   *
   * The window is printed rather than edited — the revision and the history
   * limit are one setting each, and *General* is where they are set. This
   * screen is where they are *used*, so it says what the button is about to do
   * and links to the place that changes it.
   */

  interface Props {
    /** The registry. Defaults to the app's, as the switcher's does. */
    projects?: ProjectsStore;
    /** The open project's config. Defaults to the app's. */
    config?: ProjectConfigStore;
    /** What the workbench loaded. Defaults to the app's. */
    plugins?: PluginsStore;
  }

  let {
    projects = registry,
    config = store,
    plugins = loaded,
  }: Props = $props();

  /** This browser's log for the open project; see `recents-storage.ts`. */
  let runs = $state<readonly ProjectAnalysis[]>([]);
  let opened = '';

  // Mounted without the frame — in a test, or on a direct load — the screen
  // still finds the project it is scoped to, its config and the plugins.
  $effect(() => {
    projects.load();
    plugins.load();
  });

  let project = $derived(projects.current);

  $effect(() => {
    if (project) config.load(project.id);
  });

  // Only the config that belongs to the open project: the workbench can be
  // pointed elsewhere while this screen is up, and a window read under one
  // project must never be shown under another.
  let stored = $derived(
    project && config.config && config.projectId === project.id
      ? config.config
      : null,
  );
  let plan = $derived(project && stored ? runWindow(project, stored) : null);
  let failed = $derived(
    config.status === 'error' && config.projectId === project?.id,
  );

  let entries = $derived(runPlugins(plugins.response?.plugins ?? []));
  let running = $derived(analysis.status === 'running');
  // A failure belongs to the repository it was raised for: the header can be
  // re-analysing something else by the time this screen is opened.
  let failure = $derived(
    analysis.status === 'error' && analysis.root === project?.root
      ? analysis.error
      : '',
  );

  // Open the log for whichever project this is, and fold in the run the
  // registry knows about — a run started on another machine, or in an earlier
  // session, is the server's to remember.
  $effect(() => {
    const current = project;
    if (!current) return;
    untrack(() => {
      if (opened !== current.id) {
        opened = current.id;
        runs = readRecents(current.id);
      }
      if (current.lastAnalysis) record(current.id, current.lastAnalysis);
    });
  });

  // The switcher is what usually folds a finished run into the registry, and
  // inside settings it is not mounted — so while this screen is the one on
  // screen, it does that itself. Only the report is tracked: recording writes
  // the registry this reads, and an effect that watches its own write loops.
  $effect(() => {
    const report = analysis.report;
    if (!report) return;
    untrack(() => {
      const current = projects.current;
      if (!current || current.root !== analysis.root) return;
      projects.record(report);
      record(current.id, runEntry(report));
    });
  });

  /** Fold a run into the log. A run already in it changes nothing. */
  function record(id: string, run: ProjectAnalysis): void {
    const next = mergeRun(runs, run);
    if (next === runs) return;
    runs = next;
    storeRecents(id, next);
  }
</script>

<svelte:head>
  <title>Analyze / run · Project settings · Strata</title>
</svelte:head>

<div class="max-w-3xl">
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">Analyze / run</h1>
    <p class="text-muted mt-1 text-sm">
      What a run over this project reads, who takes part in it, and what the
      last few runs found.
    </p>
  </header>

  {#if !project}
    <p class="text-muted text-sm">
      An analysis is always of one repository — pick a project in the switcher,
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
  {:else if !plan}
    <p class="text-muted text-sm">Reading this project's settings…</p>
  {:else}
    {@const root = project.root}
    <div class="space-y-6">
      <Card title="This run" hint="POST /analyze">
        <dl class="space-y-3">
          <div>
            <dt class="text-subtle text-xs">Repository root</dt>
            <dd class="mt-0.5 font-mono text-xs break-all">{plan.root}</dd>
          </div>
          <div>
            <dt class="text-subtle text-xs">Revision</dt>
            <dd class="mt-0.5 font-mono text-xs">{plan.rev}</dd>
          </div>
          <div>
            <dt class="text-subtle text-xs">History limit</dt>
            <dd class="mt-0.5 text-sm">{plan.historyLimit}</dd>
          </div>
        </dl>
        <p class="text-subtle mt-4 text-[0.6875rem]">
          The revision and the limit are the project's settings, so every run —
          this button, <em>Re-analyze</em> in the header, a headless one — reads
          the same window.
          <a
            class="text-accent hover:underline"
            href="/settings/project/general"
          >
            Change them in General
          </a>. The root is the mount, and it does not move.
        </p>
      </Card>

      <Card title="Plugins" hint="loaded in this workbench">
        <RunPlugins
          {entries}
          loading={plugins.status === 'loading'}
          error={plugins.error}
        />
        <p class="text-subtle mt-4 text-[0.6875rem]">
          Who takes part is a workbench-wide question today: what loaded here
          runs over every project, and a language module whose file types this
          repository does not hold is skipped when the run reaches it.
          Narrowing it per project is what <em>Language plugins</em> and
          <em>Metrics &amp; convention</em> will do.
        </p>
      </Card>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="bg-accent text-accent-ink hover:bg-accent-strong rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
          disabled={running}
          onclick={() => void analysis.run(root)}
        >
          {running ? 'Analysing…' : 'Run analysis'}
        </button>
        <p class="text-subtle text-xs">
          Reads the repository at the revision above; the working tree is never
          written to.
        </p>
      </div>

      {#if failure}
        <p class="text-danger text-sm" role="alert">{failure}</p>
      {/if}

      <Card title="Recent runs" hint="this browser">
        <RecentRuns {runs} />
        <p class="text-subtle mt-4 text-[0.6875rem]">
          Strata keeps the last run of every project; the rest of this list is
          what this browser has run, so a colleague's analysis of the same
          repository shows up as its most recent entry.
        </p>
      </Card>
    </div>
  {/if}
</div>
