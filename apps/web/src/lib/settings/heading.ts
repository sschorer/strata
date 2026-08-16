import type { Project } from '$lib/api';
import type { SettingsScope } from './scope';

/**
 * What a settings scope calls itself, and what it says it reaches over. The
 * rail's switcher is gone in settings mode — this is what replaces it, so it
 * has to name the thing being configured rather than only the screen.
 */
export interface ScopeHeading {
  /** What the rail and the screen call this scope. */
  title: string;
  /** What the settings apply to: the project, or the workbench itself. */
  subject: string;
  /** The line under the subject — the repository path, when there is one. */
  detail: string;
  /** How far the scope reaches, said in a sentence. */
  summary: string;
}

/** The heading for a scope, given the project the workbench is pointed at. */
export function scopeHeading(
  scope: SettingsScope,
  project: Pick<Project, 'name' | 'root'> | null,
): ScopeHeading {
  if (scope === 'app') {
    return {
      title: 'App settings',
      subject: 'This workbench',
      detail: '',
      summary: 'Applies to every project this workbench opens.',
    };
  }

  // Project settings without a project would be a form with nothing behind it,
  // so the heading says so rather than the sections failing one by one.
  if (!project) {
    return {
      title: 'Project settings',
      subject: 'No project selected',
      detail: '',
      summary:
        'These settings belong to one repository — pick a project in the switcher first.',
    };
  }

  return {
    title: 'Project settings',
    subject: project.name,
    detail: project.root,
    summary: `Applies to ${project.name} alone; every other project keeps its own.`,
  };
}
