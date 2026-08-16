<script lang="ts">
  import { analysis } from '$lib/analysis';
  import { projectLabel } from './project';

  /**
   * The project the workbench is pointed at. A switcher belongs here — a
   * dropdown over the registered projects, with *Add project* — and lands with
   * the project registry; until then this names the repository the last run
   * used, which is the one every screen is showing.
   */
  analysis.init();

  let name = $derived(projectLabel(analysis.root));
</script>

<div
  class="border-line bg-elevated rounded-lg border px-3 py-2"
  aria-label="Current project"
>
  <p class="text-subtle text-[0.625rem] tracking-wide uppercase">Project</p>
  {#if name}
    <p class="truncate text-sm font-medium" title={analysis.root}>{name}</p>
    <p class="text-subtle truncate font-mono text-[0.6875rem]" title={analysis.root}>
      {analysis.root}
    </p>
  {:else}
    <p class="text-muted text-sm">No project yet</p>
    <p class="text-subtle text-[0.6875rem]">
      Point Strata at a repository to start.
    </p>
  {/if}
</div>
