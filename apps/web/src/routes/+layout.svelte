<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { session, Unlock } from '$lib/auth';
  import { Shell } from '$lib/shell';
  import { theme } from '$lib/theme';

  let { children } = $props();

  // Adopt the stored appearance and follow the OS while the app is open.
  $effect(() => theme.start());
</script>

<!-- A locked workbench has nothing to show: every screen behind the frame is a
     failed request, and the rail would print counts it could not fetch. -->
{#if session.locked}
  <Unlock />
{:else}
  <Shell pathname={page.url.pathname}>
    {@render children()}
  </Shell>
{/if}
