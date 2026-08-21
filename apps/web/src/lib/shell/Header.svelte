<script lang="ts">
  import { analysis, RunProgress } from '$lib/analysis';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import { projectLabel, projects, ProjectSwitcher } from '$lib/projects';
  import { SettingsNav, settingsScope } from '$lib/settings';
  import NavList from './NavList.svelte';
  import RunFailure from './RunFailure.svelte';
  import RunSummary from './RunSummary.svelte';
  import { ANALYSIS_NAV, sectionLabel, SETTINGS_NAV } from './nav';

  interface Props {
    pathname: string;
  }

  let { pathname }: Props = $props();

  // *Re-analyze* re-runs whatever the workbench is pointed at, so it needs the
  // remembered path even on a reload that has not run anything yet.
  analysis.init();

  let scope = $derived(settingsScope(pathname));
  let section = $derived(sectionLabel(pathname));
  // What the switcher calls the project, falling back to the folder's name for
  // a repository that was analysed without being registered.
  let project = $derived(
    projects.current?.name ?? projectLabel(analysis.root),
  );
  // The app-wide settings are not the project's, so the crumb above them is
  // the workbench rather than whichever repository happens to be open.
  let owner = $derived(scope === 'app' ? 'Strata' : project || 'Strata');
  let running = $derived(analysis.status === 'running');
  let failed = $derived(analysis.status === 'error');
</script>

<!--
  Sticky against the scrolling pane, not the window: the rail is fixed beside
  it, so the header only ever spans the content column.
-->
<header
  class="bg-bg/85 border-line sticky top-0 z-20 border-b backdrop-blur-sm"
>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
    <nav class="min-w-0 flex-1" aria-label="Breadcrumb">
      <ol class="flex min-w-0 items-center gap-2 text-sm">
        <li
          class="text-muted min-w-0 truncate"
          title={scope === 'app' ? undefined : analysis.root}
        >
          {owner}
        </li>
        <li class="text-subtle" aria-hidden="true">/</li>
        <li class="truncate font-medium" aria-current="page">{section}</li>
      </ol>
    </nav>

    <div class="flex flex-wrap items-center gap-3">
      <!--
        While a run is on, what it is doing takes the slot the last run's
        summary had: the numbers there describe the report on screen, and the
        one being replaced is the less interesting of the two. A run that failed
        takes the same slot, and for the stronger version of the same reason —
        a summary left standing over a run that produced nothing reads as a
        result.
      -->
      {#if running}
        <div class="w-40 sm:w-56">
          <RunProgress progress={analysis.progress} />
        </div>
      {:else if failed}
        <RunFailure message={analysis.error} />
      {:else}
        <RunSummary report={analysis.report} />
      {/if}
      <button
        type="button"
        class="border-line bg-surface text-ink hover:bg-elevated rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        disabled={running || !analysis.root}
        title={analysis.root
          ? `Re-run the analysis of ${analysis.root}`
          : 'Point Strata at a repository first'}
        onclick={() => void analysis.run()}
      >
        {running ? 'Analysing…' : 'Re-analyze'}
      </button>
      <ThemeSwitch />
    </div>
  </div>

  <!--
    No room for the rail on a narrow screen: the same nav, laid across, and the
    same switcher above it — it is the only way to point the workbench at a
    project, so it cannot be the one thing the rail takes away with it. Inside
    settings the strip swaps with the rail, for the same reason the rail does.
  -->
  <div class="border-line space-y-2 border-t px-2 py-2 md:hidden">
    {#if scope}
      <SettingsNav {scope} {pathname} orientation="row" />
    {:else}
      <ProjectSwitcher />

      <NavList
        items={[...ANALYSIS_NAV, ...SETTINGS_NAV]}
        {pathname}
        orientation="row"
        label="Workbench"
      />
    {/if}
  </div>
</header>
