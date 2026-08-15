import { resolve } from 'node:path';
import type { Project, ProjectInput, ProjectUpdate } from './types.js';

/**
 * Normalise what a caller asked to register: trim the display name, and make
 * the root absolute so `/repo`, `/repo/` and a relative path are one entry
 * rather than three.
 */
export function normalizeInput(input: ProjectInput): ProjectInput {
  const name = input.name?.trim() ?? '';
  const root = input.root?.trim() ?? '';
  if (!name) throw new Error('A project needs a display name.');
  if (!root) throw new Error('A project needs a repository root.');
  return { name, root: resolve(root) };
}

/**
 * The same rules for a change to an existing project: a field left out keeps
 * what the project already has, and one that is present has to mean something
 * — `{"name": "  "}` is a mistake, not a request to clear the name.
 */
export function normalizeUpdate(
  current: Project,
  changes: ProjectUpdate,
): ProjectInput {
  return normalizeInput({
    name: changes.name ?? current.name,
    root: changes.root ?? current.root,
  });
}
