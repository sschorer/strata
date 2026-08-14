import { analyze, ApiError, type AnalysisReport } from '$lib/api';
import { readStoredRoot, storeRoot } from './root-storage';

export type AnalysisStatus = 'idle' | 'running' | 'ready' | 'error';

/**
 * The last analysis, held for the whole app: one run feeds the treemap today
 * and the overview, graph and commit screens as they land, so re-entering a
 * view must not re-run the pipeline.
 *
 * One instance, exported below — there is one workbench per window.
 */
class AnalysisStore {
  #status = $state<AnalysisStatus>('idle');
  #report = $state<AnalysisReport | null>(null);
  #error = $state('');
  #root = $state('');
  /** Lets a superseded run drop its result instead of overwriting a newer one. */
  #run = 0;

  get status(): AnalysisStatus {
    return this.#status;
  }

  get report(): AnalysisReport | null {
    return this.#report;
  }

  get error(): string {
    return this.#error;
  }

  /** The path the form edits; seeded from storage by `init()`. */
  get root(): string {
    return this.#root;
  }

  set root(value: string) {
    this.#root = value;
  }

  /** Adopt the remembered repo path. Safe to call from any view that mounts. */
  init(): void {
    if (!this.#root) this.#root = readStoredRoot() ?? '';
  }

  async run(root = this.#root): Promise<void> {
    const trimmed = root.trim();
    if (!trimmed) {
      this.#status = 'error';
      this.#error = 'Enter the absolute path of a repository to analyse.';
      return;
    }

    const run = ++this.#run;
    this.#root = trimmed;
    this.#status = 'running';
    this.#error = '';
    storeRoot(trimmed);

    try {
      const report = await analyze({ root: trimmed });
      if (run !== this.#run) return;
      this.#report = report;
      this.#status = 'ready';
    } catch (err) {
      if (run !== this.#run) return;
      this.#error =
        err instanceof ApiError ? err.message : 'Unexpected client error.';
      this.#status = 'error';
    }
  }
}

export const analysis = new AnalysisStore();
