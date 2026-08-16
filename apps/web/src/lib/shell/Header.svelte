<script lang="ts">
  import { analysis } from '$lib/analysis';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import { projectLabel, projects, ProjectSwitcher } from '$lib/projects';
  import NavList from './NavList.svelte';
  import RunSummary from './RunSummary.svelte';
  import { ANALYSIS_NAV, sectionLabel, SETTINGS_NAV } from './nav';

  interface Props {
    pathname: string;
  }

  let { pathname }: Props = $props();

  // *Re-analyze* re-runs whatever the workbench is pointed at, so it needs the
  // remembered path even on a reload that has not run anything yet.
  analysis.init();

  let section = $derived(sectionLabel(pathname));
  // What the switcher calls the project, falling back to the folder's name for
  // a repository that was analysed without being registered.
  let project = $derived(
    projects.current?.name ?? projectLabel(analysis.root),
  );
  let running = $derived(analysis.status === 'running');
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
        <li class="text-muted min-w-0 truncate" title={analysis.root}>
          {project || 'Strata'}
        </li>
        <li class="text-subtle" aria-hidden="true">/</li>
        <li class="truncate font-medium" aria-current="page">{section}</li>
      </ol>
    </nav>

    <div class="flex flex-wrap items-center gap-3">
      <RunSummary report={analysis.report} />
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
    project, so it cannot be the one thing the rail takes away with it.
  -->
  <div class="border-line space-y-2 border-t px-2 py-2 md:hidden">
    <ProjectSwitcher />

    <NavList
      items={[...ANALYSIS_NAV, ...SETTINGS_NAV]}
      {pathname}
      orientation="row"
      label="Workbench"
    />
  </div>
</header>
