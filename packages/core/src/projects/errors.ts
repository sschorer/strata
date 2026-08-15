import type { Project } from './types.js';

/**
 * A root can be registered once. Two entries for one repository would give the
 * switcher two names for the same analysis, so adding it again is refused —
 * with the entry that already holds it, so the caller can say which.
 */
export class DuplicateRootError extends Error {
  constructor(
    readonly root: string,
    readonly existing: Project,
  ) {
    super(`${root} is already registered as "${existing.name}".`);
    this.name = 'DuplicateRootError';
  }
}
