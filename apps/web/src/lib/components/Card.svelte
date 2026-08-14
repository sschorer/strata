<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    hint?: string;
    children: Snippet;
  }

  let { title, hint, children }: Props = $props();
</script>

<section
  class="bg-surface border-line shadow-card rounded-xl border p-5"
>
  <header class="mb-4 flex items-baseline justify-between gap-4">
    <h2 class="text-sm font-semibold tracking-wide uppercase">{title}</h2>
    {#if hint}
      <p class="text-subtle font-mono text-xs">{hint}</p>
    {/if}
  </header>
  {@render children()}
</section>
