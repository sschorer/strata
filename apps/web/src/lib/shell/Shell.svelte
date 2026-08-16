<script lang="ts">
  import type { Snippet } from 'svelte';
  import Header from './Header.svelte';
  import Rail from './Rail.svelte';

  interface Props {
    /** The route the app is on. The layout reads it from SvelteKit. */
    pathname: string;
    children: Snippet;
  }

  let { pathname, children }: Props = $props();
</script>

<!--
  The window is the frame: the rail and the header stay put and only the main
  pane scrolls, so a treemap or a graph canvas can size itself against the room
  it is given instead of against a page that grows underneath it.
-->
<div class="bg-bg text-ink flex h-dvh overflow-hidden">
  <Rail {pathname} />

  <div class="flex min-w-0 flex-1 flex-col overflow-y-auto">
    <Header {pathname} />

    <!-- Full width on purpose: a treemap and a graph canvas both take
         whatever room they are given, and the rail already sets the margin. -->
    <main class="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {@render children()}
    </main>
  </div>
</div>
