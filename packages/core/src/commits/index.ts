/**
 * What a report says about the analysed history window.
 *
 * The fold itself is a **stage** now (`@strata/plugin-commit-fold`), so what is
 * left here is the shape of the report field it fills and the one lookup that
 * fills it — the core counts nothing about commits of its own
 * (`docs/adr/0010`).
 */
export { foldedCommits } from './folded.js';
export type { CommitAnalytics, CommitBucket, CommitWeek } from './types.js';
