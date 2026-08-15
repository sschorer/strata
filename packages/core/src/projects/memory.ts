import { resolve } from 'node:path';
import {
  applyPatch,
  withDefaults,
  type ProjectConfig,
  type ProjectConfigPatch,
} from '../config/index.js';
import { DuplicateRootError } from './errors.js';
import { projectId } from './id.js';
import { normalizeInput, normalizeUpdate } from './input.js';
import type {
  Project,
  ProjectAnalysis,
  ProjectInput,
  ProjectStore,
  ProjectUpdate,
} from './types.js';

/**
 * A registry that lives for as long as the process does — what a workbench
 * falls back to when the database cannot be opened (a read-only container, a
 * file written by a newer Strata). Everything works; nothing survives a
 * restart, and the warning at open time says so.
 *
 * Also the store tests and callers use when they want no file at all.
 */
export function memoryProjectStore(): ProjectStore {
  const projects = new Map<string, Project>();
  const configs = new Map<string, Partial<ProjectConfig>>();

  const findByRoot = (root: string): Project | undefined => {
    const target = resolve(root);
    return [...projects.values()].find((p) => p.root === target);
  };

  return {
    path: null,
    list: () => [...projects.values()],
    get: (id) => projects.get(id),
    findByRoot,
    add(input: ProjectInput): Project {
      const { name, root } = normalizeInput(input);
      const existing = findByRoot(root);
      if (existing) throw new DuplicateRootError(root, existing);

      const project: Project = {
        id: projectId(name, (candidate) => projects.has(candidate)),
        name,
        root,
        addedAt: new Date().toISOString(),
        lastAnalysis: null,
      };
      projects.set(project.id, project);
      return project;
    },
    update(id: string, changes: ProjectUpdate): Project | undefined {
      const current = projects.get(id);
      if (!current) return undefined;

      const { name, root } = normalizeUpdate(current, changes);
      const holder = findByRoot(root);
      if (holder && holder.id !== id) {
        throw new DuplicateRootError(root, holder);
      }

      const updated = { ...current, name, root };
      projects.set(id, updated);
      return updated;
    },
    recordAnalysis(id: string, analysis: ProjectAnalysis): Project | undefined {
      const project = projects.get(id);
      if (!project) return undefined;
      const updated = { ...project, lastAnalysis: analysis };
      projects.set(id, updated);
      return updated;
    },
    config(id: string): ProjectConfig | undefined {
      if (!projects.has(id)) return undefined;
      return withDefaults(configs.get(id) ?? {});
    },
    setConfig(
      id: string,
      patch: ProjectConfigPatch,
    ): ProjectConfig | undefined {
      if (!projects.has(id)) return undefined;
      const stored = applyPatch(configs.get(id) ?? {}, patch);
      configs.set(id, stored);
      return withDefaults(stored);
    },
    remove(id) {
      configs.delete(id);
      return projects.delete(id);
    },
    close: () => {},
  };
}
