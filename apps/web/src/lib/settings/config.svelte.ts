import {
  ApiError,
  fetchProjectConfig,
  updateProjectConfig,
  type ProjectConfig,
  type ProjectConfigPatch,
} from '$lib/api';

export type ProjectConfigStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * What an analysis of the open project does — the settings behind every
 * *Project settings* section but identity, which is the registry entry the
 * switcher already holds.
 *
 * One config, held for the app: the sections are separate screens over the
 * same document, so *General* and *Scope & ignore* must not each keep their
 * own copy of the revision. It is keyed on the project it belongs to, because
 * the workbench can be pointed somewhere else while a screen is open.
 *
 * Exported as a class as well as the singleton below: a test wants its own
 * instance, the app wants one.
 */
export class ProjectConfigStore {
  #status = $state<ProjectConfigStatus>('idle');
  #config = $state<ProjectConfig | null>(null);
  #error = $state('');
  #project = $state<string | null>(null);
  /** Lets a superseded load drop its result instead of overwriting a newer one. */
  #run = 0;

  get status(): ProjectConfigStatus {
    return this.#status;
  }

  /** The config held, or `null` until one has arrived. */
  get config(): ProjectConfig | null {
    return this.#config;
  }

  get error(): string {
    return this.#error;
  }

  /** Whose config this is — a screen reads it before trusting `config`. */
  get projectId(): string | null {
    return this.#project;
  }

  /**
   * Load a project's config once. Safe to call from every section that mounts;
   * a different project supersedes whatever is held, because a config read
   * under one project must never be shown — or saved — under another.
   */
  load(id: string): void {
    if (this.#project === id && this.#status !== 'idle') return;
    void this.reload(id);
  }

  async reload(id: string): Promise<void> {
    const run = ++this.#run;
    this.#project = id;
    this.#status = 'loading';
    this.#config = null;
    this.#error = '';
    try {
      const config = await fetchProjectConfig(id);
      if (run !== this.#run) return;
      this.#config = config;
      this.#status = 'ready';
    } catch (err) {
      if (run !== this.#run) return;
      this.#error = message(err);
      this.#status = 'error';
    }
  }

  /**
   * Write a patch and hold what came back. The server normalises what it
   * stores, so its answer is the config — holding the patch instead would show
   * the reader their own input rather than the setting. Throws for the form to
   * show; a rejected save leaves what is held untouched.
   */
  async save(id: string, patch: ProjectConfigPatch): Promise<ProjectConfig> {
    const config = await updateProjectConfig(id, patch);
    // A save that lands after the workbench moved on belongs to a project this
    // store no longer holds; the write stands, the screen's copy does not.
    if (this.#project === id) {
      this.#config = config;
      this.#error = '';
      this.#status = 'ready';
    }
    return config;
  }
}

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Unexpected client error.';
}

export const projectConfig = new ProjectConfigStore();
