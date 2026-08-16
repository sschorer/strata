<script lang="ts">
  import type { StatCard, StatTone } from './stats';

  interface Props {
    card: StatCard;
  }

  let { card }: Props = $props();

  const INK: Record<StatTone, string> = {
    plain: 'text-ink',
    warn: 'text-warn',
    danger: 'text-danger',
  };

  const SHELL =
    'bg-surface border-line shadow-card block min-w-0 rounded-xl border p-4';
</script>

{#snippet body()}
  <p class="text-subtle text-xs">{card.label}</p>
  <p
    class="mt-1 truncate font-mono text-2xl {INK[card.tone]}"
    title={card.title ?? card.value}
  >
    {card.value}
  </p>
  <p class="text-muted mt-0.5 truncate text-xs">{card.hint}</p>
{/snippet}

<!-- A card links to the screen that shows its number in full, where that
     screen exists; the rest are plain, because an inert link is worse than
     none (see the rail's planned entries). -->
{#if card.href}
  <a class="{SHELL} hover:border-line-strong" href={card.href}>
    {@render body()}
  </a>
{:else}
  <div class={SHELL}>
    {@render body()}
  </div>
{/if}
