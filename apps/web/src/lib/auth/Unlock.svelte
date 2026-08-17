<script lang="ts">
  import { ApiError } from '$lib/api';
  import { session } from './session.svelte';
  import { verifyToken } from './verify';

  interface Props {
    /**
     * What to do once the token is accepted. The default reloads: every store
     * in the app loads once and is holding a failed request by the time this
     * panel is up, and a reload is the honest way to start them over.
     */
    onunlocked?: () => void;
  }

  let { onunlocked = () => location.reload() }: Props = $props();

  let token = $state('');
  let busy = $state(false);
  let error = $state('');

  async function submit(): Promise<void> {
    const candidate = token.trim();
    if (!candidate) {
      error = 'Enter the token this workbench was started with.';
      return;
    }

    busy = true;
    error = '';
    try {
      await verifyToken(candidate);
      session.unlock(candidate);
      onunlocked();
    } catch (err) {
      // 401 is the one failure worth rewording: the server's message tells a
      // caller how to send a token, and this reader just did.
      error =
        err instanceof ApiError
          ? err.status === 401
            ? 'That token was not accepted.'
            : err.message
          : 'Unexpected client error.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="bg-bg text-ink grid min-h-screen place-items-center p-6">
  <main
    class="bg-surface border-line shadow-card w-full max-w-sm rounded-xl border p-6"
  >
    <h1 class="text-base font-semibold">This workbench is locked</h1>
    <p class="text-muted mt-2 text-sm">
      {#if session.refused}
        The token this browser had was refused. It has been forgotten — enter
        the current one.
      {:else}
        The server was started with a token
        (<code class="font-mono text-xs">STRATA_TOKEN</code>). Enter it to
        continue.
      {/if}
    </p>

    <form
      class="mt-5 space-y-3"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div>
        <label class="text-subtle text-xs" for="unlock-token">Token</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="border-line bg-bg text-ink placeholder:text-subtle mt-1 w-full rounded-md border px-2 py-1.5 font-mono text-xs"
          id="unlock-token"
          type="password"
          name="token"
          autocomplete="current-password"
          autofocus
          spellcheck="false"
          placeholder="••••••••••••••••"
          bind:value={token}
        />
      </div>

      {#if error}
        <p class="text-danger text-xs" role="alert">{error}</p>
      {/if}

      <button
        type="submit"
        class="bg-accent text-accent-ink hover:bg-accent-strong w-full rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60"
        disabled={busy}
      >
        {busy ? 'Checking…' : 'Unlock'}
      </button>
    </form>

    <p class="text-subtle mt-4 text-xs">
      Kept in this browser until the server turns it down.
    </p>
  </main>
</div>
