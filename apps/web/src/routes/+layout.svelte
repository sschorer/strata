<script lang="ts">
  import '../app.css';
  import { theme } from '$lib/theme';

  let { children } = $props();

  // Adopt the stored appearance and follow the OS while the app is open.
  $effect(() => theme.start());
</script>

<div class="min-h-screen bg-bg text-ink">
  {@render children()}
</div>
