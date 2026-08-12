import {
  defineCommitConventionPlugin,
  type ParsedCommit,
  type RawCommit,
} from '@strata/sdk';

/**
 * Conventional Commits parser.
 * https://www.conventionalcommits.org/
 *
 * Matches:  type(scope)!: subject
 * Captures breaking changes via the `!` marker or a `BREAKING CHANGE:` footer,
 * and pulls issue references (#123) and co-authors into `tags` so downstream
 * analytics can group by them. Swap this plugin out for gitmoji / Jira / a
 * custom convention without touching the core.
 */
const HEADER = /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s(?<subject>.+)$/;
const ISSUE = /#(\d+)/g;
const COAUTHOR = /^Co-authored-by:\s*(.+)$/gim;

export default defineCommitConventionPlugin({
  convention: 'conventional',
  parse(commit: RawCommit): ParsedCommit {
    const [header] = commit.message.split('\n');
    const m = header!.match(HEADER);

    const issues = [...commit.message.matchAll(ISSUE)].map((x) => x[1]!);
    const coauthors = [...commit.message.matchAll(COAUTHOR)].map((x) =>
      x[1]!.trim(),
    );
    const tags: Record<string, string[]> = {};
    if (issues.length) tags.issues = issues;
    if (coauthors.length) tags.coauthors = coauthors;

    if (!m?.groups) {
      return {
        type: null,
        scope: null,
        breaking: false,
        subject: header ?? '',
        tags,
        valid: false,
      };
    }

    const breaking =
      m.groups.breaking === '!' || /BREAKING CHANGE:/.test(commit.message);

    return {
      type: m.groups.type ?? null,
      scope: m.groups.scope ?? null,
      breaking,
      subject: m.groups.subject ?? '',
      tags,
      valid: true,
    };
  },
});
