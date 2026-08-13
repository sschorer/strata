export interface ParsedCommit {
  /** The change type: "feat", "fix", … or null when it doesn't match. */
  type: string | null;
  scope: string | null;
  /** True when the commit signals a breaking change. */
  breaking: boolean;
  subject: string;
  /** Arbitrary extracted tags: issue refs, gitmoji, co-authors, … */
  tags: Record<string, string[]>;
  /** True when the message satisfied this convention at all. */
  valid: boolean;
}

export interface RawCommit {
  sha: string;
  author: string;
  authorEmail: string;
  date: string;
  /** Full commit message (subject + body). */
  message: string;
}

export interface CommitConventionPlugin {
  kind: 'commit-convention';
  /** e.g. "conventional", "gitmoji", "custom-jira". */
  convention: string;
  parse(commit: RawCommit): ParsedCommit;
}

export function defineCommitConventionPlugin(
  p: Omit<CommitConventionPlugin, 'kind'>,
): CommitConventionPlugin {
  return { kind: 'commit-convention', ...p };
}
