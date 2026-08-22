/**
 * One thing a stage found and a reader can act on: a dead export, an import
 * that crosses a layer it may not, a file nobody reaches.
 *
 * Deliberately not one kind of finding. The set of output types is closed
 * (`docs/adr/0010`), so every stage whose result is a list of complaints
 * reports it in this shape — and a screen, a CI gate and a second API client
 * read all of them the same way, whichever stage produced them.
 */
export interface Finding {
  /**
   * What found it: a rule id, a check name. Stable enough for a repository to
   * name in its configuration and for two runs to be compared by it.
   */
  rule: string;
  /** Repo-relative file it is about; `null` when it is about the repository. */
  path: string | null;
  /** One line, in the stage's own words — what a list of findings prints. */
  message: string;
  /** Line within `path`, where the stage knows one. */
  line?: number;
  /** Symbol within `path`, where the finding is about one. */
  symbol?: string;
  /** How loudly to say it. A gate reads this, never the wording. */
  severity: 'info' | 'warning' | 'error';
}
