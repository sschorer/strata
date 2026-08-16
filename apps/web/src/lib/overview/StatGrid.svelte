<script lang="ts">
  import StatCardView from './StatCard.svelte';
  import type { StatCard } from './stats';

  interface Props {
    cards: StatCard[];
  }

  let { cards }: Props = $props();
</script>

<!-- Six across on a wide screen, folding to three and then two: the row is a
     row, and a card that has to wrap is still a card rather than a table. -->
<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
  {#each cards as card (card.key)}
    <StatCardView {card} />
  {/each}
</div>
