import { resolve } from 'node:path';
import type { ProjectInput } from './types.js';

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
