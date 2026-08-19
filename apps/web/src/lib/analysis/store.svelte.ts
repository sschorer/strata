import {
  ApiError,
  startAnalysis,
  type AnalysisProgress,
  type AnalysisReport,
} from '$lib/api';
import { followJob } from './follow';
import { readStoredRoot, storeRoot } from './root-storage';

export type AnalysisStatus = 'idle' | 'running' | 'ready' | 'error';

/**
 * The last analysis, held for the whole app: one run feeds the treemap today
 * and the overview, graph and commit screens as they land, so re-entering a
 * view must not re-run the pipeline.
 *
 * A run is a job on the server, not a request left open: this asks for one,
 * gets an id back straight away and follows it, so *Re-analyze* shows what the
 * pipeline is doing while it does it instead of a button that has stopped
 * responding. The screens read `status` and `progress`; where the work happens
 * is the server's business.
 *
 * One instance, exported below — there is one workbench per window.
 */
class AnalysisStore {
  #status = $state<AnalysisStatus>('idle');
  #report = $state<AnalysisReport | null>(null);
  #progress = $state<AnalysisProgress | null>(null);
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

  /** Where the running analysis has got to; null when none is running. */
  get progress(): AnalysisProgress | null {
    return this.#progress;
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

  /**
   * Point the workbench at another repository — what the project switcher does
   * when a project is picked, and what it does with an empty root when the
   * selected project is removed.
   *
   * The report goes with it: it describes the repository that was analysed, so
   * leaving it up would draw one project's graph under another project's name.
   * A run still in flight over the old root is superseded for the same reason.
   */
  select(root: string): void {
    const trimmed = root.trim();
    if (trimmed === this.#root) return;
    this.#run++;
    this.#root = trimmed;
    this.#report = null;
    this.#progress = null;
    this.#error = '';
    this.#status = 'idle';
    storeRoot(trimmed);
  }

  /**
   * Ask for a run and follow it to the end.
   *
   * The job on the server outlives this call — a run the workbench walked away
   * from still finishes, and still updates the project's last-run summary. What
   * `#run` guards is only whether *this* window adopts the result: pointing the
   * workbench elsewhere mid-run must not drop another project's report onto the
   * screen when the old one lands.
   */
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
    this.#progress = null;
    this.#error = '';
    storeRoot(trimmed);

    try {
      const { job } = await startAnalysis({ root: trimmed });
      const finished = await followJob(job.id, (update) => {
        if (run === this.#run) this.#progress = update.progress;
      });
      if (run !== this.#run) return;
      this.#progress = null;
      if (finished.report) {
        this.#report = finished.report;
        this.#status = 'ready';
        return;
      }
      this.#error = finished.error ?? 'The analysis failed.';
      this.#status = 'error';
    } catch (err) {
      if (run !== this.#run) return;
      this.#progress = null;
      this.#error =
        err instanceof ApiError ? err.message : 'Unexpected client error.';
      this.#status = 'error';
    }
  }
}

export const analysis = new AnalysisStore();
