import type { Project } from '$lib/api';
import { compactNumber, relativeAge } from '$lib/format';

/** One row of the switcher — strings, ready to paint. */
export interface ProjectEntry {
  id: string;
  name: string;
  root: string;
  /** Whether an analysis of this project has ever finished. */
  analysed: boolean;
  /** Files the last run saw, abbreviated; empty until one has run. */
  files: string;
  /** How long ago that run finished, or what to say instead. */
  age: string;
}

/**
 * What the dropdown shows about a project: how big the repository was the last
 * time Strata looked, and how long ago that was. Both come from the registry —
 * the server records every run over a registered root — so the list is
 * readable without analysing anything.
 */
export function projectEntry(
  project: Project,
  now: number = Date.now(),
): ProjectEntry {
  const last = project.lastAnalysis;
  return {
    id: project.id,
    name: project.name,
    root: project.root,
    analysed: last !== null,
    files: last ? compactNumber(last.files) : '',
    age: last ? relativeAge(last.finishedAt, now) : 'Never analysed',
  };
}

/** The registry in the order it is kept: oldest registration first. */
export function projectEntries(
  projects: readonly Project[],
  now: number = Date.now(),
): ProjectEntry[] {
  return projects.map((project) => projectEntry(project, now));
}
