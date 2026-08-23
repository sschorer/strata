import type { ParsedCommit, RawCommit } from '@strata/sdk';
import { headerLine, parseHeader } from './header.js';
import { extractTags, hasBreakingFooter } from './tags.js';

/**
 * One commit message, read as [Conventional Commits](https://www.conventionalcommits.org/)
 * writes them: `type(scope)!: subject` (`header.ts`), a breaking change marked
 * by the `!` or by a `BREAKING CHANGE:` footer, and issue references and
 * co-authors pulled into `tags` (`tags.ts`).
 *
 * A message that is not conventional at all is *parsed*, not rejected: it comes
 * back `valid: false` with its header line as the subject, because a repository
 * where half the history is unconventional should be able to say so.
 */
export function parseCommit(commit: RawCommit): ParsedCommit {
  const tags = extractTags(commit.message);
  const header = parseHeader(commit.message);

  if (!header) {
    return {
      type: null,
      scope: null,
      breaking: false,
      subject: headerLine(commit.message),
      tags,
      valid: false,
    };
  }

  return {
    type: header.type,
    scope: header.scope,
    breaking: header.bang || hasBreakingFooter(commit.message),
    subject: header.subject,
    tags,
    valid: true,
  };
}
