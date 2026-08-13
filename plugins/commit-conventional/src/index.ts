import {
  defineCommitConventionPlugin,
  type ParsedCommit,
  type RawCommit,
} from '@strata/sdk';
import { headerLine, parseHeader } from './header.js';
import { extractTags, hasBreakingFooter } from './tags.js';

/**
 * Conventional Commits parser.
 * https://www.conventionalcommits.org/
 *
 * Matches `type(scope)!: subject` (`header.ts`), captures breaking changes via
 * the `!` marker or a `BREAKING CHANGE:` footer, and pulls issue references and
 * co-authors into `tags` (`tags.ts`). Swap this plugin out for gitmoji / Jira /
 * a custom convention without touching the core.
 */
export default defineCommitConventionPlugin({
  convention: 'conventional',
  parse(commit: RawCommit): ParsedCommit {
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
  },
});
