<script lang="ts">
  import { projects as registry, type ProjectsStore } from '$lib/projects';
  import SectionList from './SectionList.svelte';
  import { scopeHeading } from './heading';
  import { sectionsFor } from './sections';
  import type { SettingsScope } from './scope';

  /**
   * The landing screen of a settings scope: what is being configured, how far
   * it reaches, and the sections it is divided into. Both scopes render it —
   * the scope is the only thing that differs, and a second copy of this page
   * would be a second answer to "what can be configured here".
   */

  interface Props {
    scope: SettingsScope;
    /** The registry. Defaults to the app's, as the switcher's does. */
    projects?: ProjectsStore;
  }

  let { scope, projects = registry }: Props = $props();

  // Mounted without the frame — in a test, or on a direct load — the screen
  // still knows which project it is scoped to.
  $effect(() => {
    projects.load();
  });

  let heading = $derived(scopeHeading(scope, projects.current));
  let sections = $derived(sectionsFor(scope));
</script>

<svelte:head>
  <title>{heading.title} · Strata</title>
</svelte:head>

<div>
  <header class="mb-8">
    <h1 class="text-2xl font-semibold">{heading.title}</h1>
    <p class="text-muted mt-1 max-w-3xl text-sm">{heading.summary}</p>
    {#if heading.detail}
      <p class="text-subtle mt-1 font-mono text-xs">{heading.detail}</p>
    {/if}
  </header>

  <SectionList {sections} />
</div>
