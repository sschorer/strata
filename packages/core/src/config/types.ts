/** One architecture fitness rule: `from` may not import `to`. */
export interface ArchitectureRule {
  /** Path glob the rule constrains, e.g. `src/ui/**`. */
  from: string;
  /** Path glob it may not reach, e.g. `src/db/**`. */
  to: string;
  /**
   * Enforced rules are meant to fail a CI gate; the rest only report. A new
   * rule reports until it is marked enforced — turning a build red is a
   * decision, not a side effect of writing the rule down.
   */
  enforced: boolean;
}

/**
 * Everything the *Project settings* screens configure about one project's
 * analyses. Identity (id, display name, root) belongs to the registry entry
 * itself, not here: this is what an analysis of that repository *does*.
 *
 * Stored sparsely — only what was explicitly set — and merged with the
 * defaults on read, so a default that changes in a later release reaches every
 * project that never overrode it.
 */
export interface ProjectConfig {
  /** Revision to analyse. `HEAD` by default. */
  rev: string;
  /** Cap on the history window, in commits; `null` for the whole history. */
  historyLimit: number | null;
  /** Globs excluded from the analysis. */
  ignore: string[];
  /** Repo-relative paths to analyse; empty means the whole repository. */
  paths: string[];
  /**
   * Ids of the `language` plugins that may run, or `null` for every registered
   * one. An explicit list is an allow-list: a plugin installed later is not in
   * it until it is added.
   */
  languages: string[] | null;
  /** Ids of the `git-metric` plugins that may run, or `null` for all of them. */
  metrics: string[] | null;
  /**
   * Id of the `commit-convention` plugin to parse commits with, or `null` to
   * take the first registered one (what the core does today).
   */
  convention: string | null;
  /** Architecture rules to check. */
  rules: ArchitectureRule[];
}

/**
 * A partial update. Every field is replaced whole — an array field is the new
 * list, not an addition to the old one — so an editor that renders the current
 * config can send back exactly what it shows.
 */
export type ProjectConfigPatch = Partial<ProjectConfig>;
