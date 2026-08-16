import { ApiError, fetchPlugins, type PluginsResponse } from '$lib/api';

export type PluginsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * What the workbench loaded. The rail prints the count, the overview will list
 * the plugins themselves, and the settings screens read the same response — so
 * it is fetched once for the app rather than per screen.
 *
 * Exported as a class as well as the singleton below: a test wants its own
 * instance, the app wants one.
 */
export class PluginsStore {
  #status = $state<PluginsStatus>('idle');
  #response = $state<PluginsResponse | null>(null);
  #error = $state('');

  get status(): PluginsStatus {
    return this.#status;
  }

  get response(): PluginsResponse | null {
    return this.#response;
  }

  get error(): string {
    return this.#error;
  }

  /** How many plugins loaded; `null` until the first response arrives. */
  get count(): number | null {
    return this.#response ? this.#response.plugins.length : null;
  }

  /** Plugins that were found but could not be loaded. */
  get failures(): number {
    return this.#response?.failures.length ?? 0;
  }

  /**
   * Load once. Safe to call from every component that mounts — the second
   * caller joins the first request instead of making another.
   */
  load(): void {
    if (this.#status !== 'idle') return;
    void this.reload();
  }

  async reload(): Promise<void> {
    this.#status = 'loading';
    try {
      this.#response = await fetchPlugins();
      this.#error = '';
      this.#status = 'ready';
    } catch (err) {
      this.#error =
        err instanceof ApiError ? err.message : 'Unexpected client error.';
      this.#status = 'error';
    }
  }
}

export const plugins = new PluginsStore();
