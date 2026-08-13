const ISSUE = /#(\d+)/g;
const COAUTHOR = /^Co-authored-by:\s*(.+)$/gim;

/**
 * Pull issue references and co-authors out of the whole message, so downstream
 * analytics can group by them. Extend here for gitmoji, Jira keys, …
 */
export function extractTags(message: string): Record<string, string[]> {
  const issues = [...message.matchAll(ISSUE)].map((x) => x[1]!);
  const coauthors = [...message.matchAll(COAUTHOR)].map((x) => x[1]!.trim());

  const tags: Record<string, string[]> = {};
  if (issues.length) tags.issues = issues;
  if (coauthors.length) tags.coauthors = coauthors;
  return tags;
}

/** A `BREAKING CHANGE:` footer anywhere in the body. */
export function hasBreakingFooter(message: string): boolean {
  return /BREAKING CHANGE:/.test(message);
}
