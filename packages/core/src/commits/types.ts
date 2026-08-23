/**
 * One `type` or `scope` of the analysed history window.
 *
 * `name` is `null` where the commit named none — an unconventional message has
 * no type, a `feat: …` without parentheses has no scope — rather than being
 * folded into a bucket called "other", which a repository is free to use as a
 * real type.
 */
export interface CommitBucket {
  name: string | null;
  count: number;
  /** 0–1 of every parsed commit in the window. */
  share: number;
  /** How many of them announced a breaking change. */
  breaking: number;
}

/** One week of the activity series. */
export interface CommitWeek {
  /** Monday of the week (UTC), `YYYY-MM-DD`. */
  week: string;
  commits: number;
}

/**
 * What the *Commit analytics* screen prints, as the **commit fold** stage
 * produced it and the report still carries it.
 *
 * Declared here rather than imported from the plugin, because it is the shape
 * of a report field and a report is the core's: the fold is an `aggregate`,
 * which the core carries and never reads inside, and only a consumer that means
 * that one producer — this field, and the screen behind it — narrows it. Both
 * go when the screens read stage entries instead (`docs/adr/0011`).
 *
 * `total` counts the analysed window; everything the convention decides is
 * counted over the commits it actually parsed, which is the same set whenever a
 * convention took part and empty when none did — an unparsed history then
 * reports its activity and claims nothing about conformance, rather than
 * reporting every commit as non-conforming.
 */
export interface CommitAnalytics {
  /** Commits in the analysed history window. */
  total: number;
  /** Commits the convention parsed at all. */
  valid: number;
  /** Parsed commits it could not make sense of — the `6 non-conforming`. */
  invalid: number;
  /** 0–1 of the judged commits; 0 when nothing judged them. */
  validRate: number;
  /** Commits announcing a breaking change, however the convention marks one. */
  breaking: number;
  /** By change type, biggest first. */
  types: CommitBucket[];
  /** By scope, biggest first. */
  scopes: CommitBucket[];
  /** Contiguous weeks, oldest first — a week with no commits included as 0. */
  weeks: CommitWeek[];
}
