<script lang="ts">
  import { troubleVerb } from './phrase';
  import type { StageTrouble } from './trouble';

  interface Props {
    /** The stages that produced nothing, in the place their output would be. */
    troubles: StageTrouble[];
    /** What is missing, named as the screen names it: "the import graph". */
    what?: string;
  }

  let { troubles, what = 'its output' }: Props = $props();
</script>

<!-- Printed where the output would have gone, because an empty panel reads as
     good news and a stage that threw is the opposite of that (`docs/adr/0015`).
     A failure and a stage that never ran are told apart in words, not only in
     colour, and the entry's own reason says which kind of "did not run" it was
     — an upstream that failed, or nothing to work on. -->
<div class="flex flex-col gap-3">
  {#each troubles as trouble (trouble.id)}
    <p class="text-sm">
      <span
        class:text-danger={trouble.status === 'failed'}
        class:text-warn={trouble.status === 'skipped'}
      >
        <span class="font-mono text-xs">{trouble.id}</span>
        {troubleVerb(trouble)}, so {what}
        {trouble.status === 'failed'
          ? 'is not knowable'
          : 'is not in this report'}.
      </span>
      <span class="text-muted mt-1 block text-xs">{trouble.reason}</span>
    </p>
  {/each}
</div>
