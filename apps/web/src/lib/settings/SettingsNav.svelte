<script lang="ts">
  import { projects as registry, type ProjectsStore } from '$lib/projects';
  import NavList from '$lib/shell/NavList.svelte';
  import { scopeHeading } from './heading';
  import { sectionsFor } from './sections';
  import type { SettingsScope } from './scope';

  /**
   * The rail, in settings mode: the way back to the workbench, the scope this
   * is configuring, and the sections it holds. It replaces the switcher rather
   * than sitting beside it — settings belong to the project that is open, and
   * two ways to say which one that is would eventually disagree.
   */

  interface Props {
    scope: SettingsScope;
    /** The route the app is on; decides which section is current. */
    pathname: string;
    /** `column` in the rail, `row` in the narrow-screen strip. */
    orientation?: 'column' | 'row';
    /** The registry. Defaults to the app's, as the switcher's does. */
    projects?: ProjectsStore;
  }

  let {
    scope,
    pathname,
    orientation = 'column',
    projects = registry,
  }: Props = $props();

  // The switcher is what usually loads the registry, and it is exactly what
  // this replaces — so a reader who opened a settings route from a bookmark
  // still gets the project's name in the heading. Load-once, as there too.
  $effect(() => {
    projects.load();
  });

  let heading = $derived(scopeHeading(scope, projects.current));
  let sections = $derived(sectionsFor(scope));
</script>

{#snippet back()}
  <!-- Back to the workbench, not back in history: a reader who landed here
       from a link has nothing behind them, and the overview always exists. -->
  <a
    href="/"
    class="text-muted hover:bg-elevated hover:text-ink flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M7.5 2.5 4 6l3.5 3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <span class="truncate">Back to workbench</span>
  </a>
{/snippet}

{#if orientation === 'row'}
  <!-- Below `md` there is no rail: the same two things, laid across. -->
  <div class="flex items-center gap-1 overflow-x-auto">
    <div class="shrink-0">
      {@render back()}
    </div>
    <span class="border-line h-5 shrink-0 border-l" aria-hidden="true"></span>
    <NavList
      items={sections}
      {pathname}
      orientation="row"
      label={heading.title}
    />
  </div>
{:else}
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="px-3 pb-2">
      {@render back()}
    </div>

    <div class="border-line mx-3 border-t pt-3 pb-1">
      <p class="text-subtle px-3 text-[0.625rem] tracking-wide uppercase">
        {heading.title}
      </p>
      <p class="truncate px-3 text-sm font-medium" title={heading.detail}>
        {heading.subject}
      </p>
      {#if heading.detail}
        <p
          class="text-subtle truncate px-3 font-mono text-[0.6875rem]"
          title={heading.detail}
        >
          {heading.detail}
        </p>
      {/if}
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto px-3 py-2" aria-label="Settings">
      <NavList items={sections} {pathname} label="{heading.title} sections" />
    </nav>
  </div>
{/if}
