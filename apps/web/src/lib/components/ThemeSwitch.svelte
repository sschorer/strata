<script lang="ts">
  import { theme, THEME_MODES } from '$lib/theme';
</script>

<div
  class="border-line bg-surface inline-flex items-center gap-1 rounded-lg border p-1"
  role="group"
  aria-label="Theme"
>
  {#each THEME_MODES as mode (mode)}
    <button
      type="button"
      class="rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors
             {theme.mode === mode
        ? 'bg-accent text-accent-ink'
        : 'text-muted hover:bg-elevated hover:text-ink'}"
      aria-pressed={theme.mode === mode}
      onclick={() => theme.set(mode)}
    >
      {mode}
    </button>
  {/each}
</div>
