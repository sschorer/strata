<script lang="ts">
  import type { SettingsSection } from './sections';

  /**
   * The sections of a scope, with the line that says what each one holds. The
   * rail lists the same sections by name; this is the landing screen, where
   * there is room to say what a name means.
   */

  interface Props {
    sections: readonly SettingsSection[];
  }

  let { sections }: Props = $props();
</script>

<ul class="grid gap-3 sm:grid-cols-2">
  {#each sections as section (section.href)}
    <li>
      {#if section.status === 'planned'}
        <!-- On the backlog: shown so the map is complete, inert so it cannot
             lead anywhere that is not there yet. -->
        <div
          class="border-line bg-surface h-full rounded-xl border p-4 opacity-70"
          aria-disabled="true"
        >
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-medium">{section.label}</h2>
            <span
              class="text-subtle shrink-0 text-[0.625rem] tracking-wide uppercase"
            >
              soon
            </span>
          </div>
          <p class="text-muted mt-1 text-sm">{section.description}</p>
        </div>
      {:else}
        <a
          href={section.href}
          class="border-line bg-surface hover:border-line-strong hover:bg-elevated block h-full rounded-xl border p-4 transition-colors"
        >
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-sm font-medium">{section.label}</h2>
            <span class="text-subtle shrink-0" aria-hidden="true">→</span>
          </div>
          <p class="text-muted mt-1 text-sm">{section.description}</p>
        </a>
      {/if}
    </li>
  {/each}
</ul>
