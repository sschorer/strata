<script lang="ts">
  import { analysis } from './store.svelte';

  // Until the project switcher lands, the repo to analyse is typed here and
  // remembered in storage. The server resolves the path on its own machine.
  analysis.init();
  let root = $state(analysis.root);
</script>

<form
  class="flex flex-wrap items-end gap-3"
  onsubmit={(event) => {
    event.preventDefault();
    void analysis.run(root);
  }}
>
  <label class="min-w-64 flex-1">
    <span class="text-subtle mb-1 block text-xs">Repository path</span>
    <input
      class="border-line bg-bg text-ink placeholder:text-subtle w-full rounded-lg border px-3 py-2 font-mono text-sm"
      type="text"
      name="root"
      autocomplete="off"
      spellcheck="false"
      placeholder="/absolute/path/to/repo"
      bind:value={root}
    />
  </label>
  <button
    type="submit"
    class="bg-accent text-accent-ink hover:bg-accent-strong rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
    disabled={analysis.status === 'running'}
  >
    {analysis.status === 'running' ? 'Analysing…' : 'Run analysis'}
  </button>
</form>
