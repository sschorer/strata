<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { Shell } from '$lib/shell';
  import { theme } from '$lib/theme';

  let { children } = $props();

  // Adopt the stored appearance and follow the OS while the app is open.
  $effect(() => theme.start());
</script>

<Shell pathname={page.url.pathname}>
  {@render children()}
</Shell>
