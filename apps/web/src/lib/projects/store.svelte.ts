import { analysis } from '$lib/analysis';
import {
  addProject,
  ApiError,
  fetchProjects,
  removeProject,
  updateProject,
  type AddProjectRequest,
  type AnalysisReport,
  type Project,
  type UpdateProjectRequest,
} from '$lib/api';
import { readSelection, storeSelection } from './selection';

export type ProjectsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The registered projects and which one the workbench is on — the switcher's
 * state, held for the whole app because the rail, the header's breadcrumb and
 * (later) the project settings screens all read the same answer.
 *
 * Selecting a project is what points the analysis at a repository: this store
 * owns the choice, `analysis` owns the run over it.
 *
 * Exported as a class as well as the singleton below: a test wants its own
 * instance, the app wants one.
 */
export class ProjectsStore {
  #status = $state<ProjectsStatus>('idle');
  #projects = $state<Project[]>([]);
  #error = $state('');
  #selected = $state<string | null>(null);

  get status(): ProjectsStatus {
    return this.#status;
  }

  get projects(): readonly Project[] {
    return this.#projects;
  }

  get error(): string {
    return this.#error;
  }

  /** The project the workbench is pointed at; `null` when none is chosen. */
  get current(): Project | null {
    return this.#projects.find((project) => project.id === this.#selected) ?? null;
  }

  /**
   * Load once. Safe to call from every component that mounts — the rail and
   * the narrow-screen header both hold a switcher, and one registry is enough.
   */
  load(): void {
    if (this.#status !== 'idle') return;
    void this.reload();
  }

  async reload(): Promise<void> {
    this.#status = 'loading';
    try {
      const { projects } = await fetchProjects();
      this.#projects = projects;
      this.#error = '';
      this.#status = 'ready';
      this.#adopt();
    } catch (err) {
      this.#error = message(err);
      this.#status = 'error';
    }
  }

  /** Point the workbench at a registered project. Unknown ids are ignored. */
  select(id: string): void {
    const project = this.#projects.find((entry) => entry.id === id);
    if (!project) return;
    this.#selected = project.id;
    storeSelection(project.id);
    analysis.select(project.root);
  }

  /**
   * Register a repository and select it, so *Add project* lands on the new
   * project rather than leaving the reader where they were. Throws what the
   * server said — an unknown path or an already registered root — for the form
   * to show next to the field.
   */
  async add(input: AddProjectRequest): Promise<Project> {
    const project = await addProject(input);
    this.#projects = [...this.#projects, project];
    this.select(project.id);
    return project;
  }

  /**
   * Rename a project, or re-point it — what *Project settings → General*
   * writes. The entry the server hands back replaces the one held here, so the
   * switcher and the settings heading are renamed by the same round-trip.
   *
   * A root that moved re-points the analysis too: the report on screen
   * describes the repository that was analysed, and `analysis.select` drops it
   * for the same reason picking another project does. Throws what the server
   * said — an unknown id, a path outside a repository, a root another project
   * already holds — for the form to show next to the field.
   */
  async update(id: string, input: UpdateProjectRequest): Promise<Project> {
    const updated = await updateProject(id, input);
    this.#projects = this.#projects.map((project) =>
      project.id === id ? updated : project,
    );
    if (this.#selected === id) analysis.select(updated.root);
    return updated;
  }

  /**
   * Drop a project from the registry. Removing the one that is selected leaves
   * the workbench pointed at nothing rather than silently at its neighbour.
   */
  async remove(id: string): Promise<void> {
    await removeProject(id);
    this.#projects = this.#projects.filter((project) => project.id !== id);
    if (this.#selected !== id) return;
    this.#selected = null;
    storeSelection(null);
    analysis.select('');
  }

  /**
   * Fold a finished run into the selected project's row. The server already
   * recorded it against the registry — this is the same summary, applied
   * locally, so the age in the dropdown is right without a second round-trip.
   */
  record(report: AnalysisReport): void {
    const id = this.#selected;
    if (!id) return;
    this.#projects = this.#projects.map((project) =>
      project.id === id
        ? { ...project, lastAnalysis: { rev: report.rev, ...report.run } }
        : project,
    );
  }

  /**
   * Which project the app comes back to after a reload: the one it was on,
   * else whichever is registered for the repository path the last run used.
   * Nothing matches on a first visit, and the reader picks from the dropdown.
   */
  #adopt(): void {
    if (this.#selected) return;
    analysis.init();
    const stored = readSelection();
    const project =
      this.#projects.find((entry) => entry.id === stored) ??
      this.#projects.find((entry) => entry.root === analysis.root);
    if (project) this.select(project.id);
  }
}

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Unexpected client error.';
}

export const projects = new ProjectsStore();
