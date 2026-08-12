/**
 * Conventional Commits enforcement.
 *
 * Strata's own history is analysed by the same commit-convention plugin that
 * ships in `plugins/commit-conventional`, so we keep our commits conventional
 * to dogfood it. Extend `type-enum` as new scopes/types emerge.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'docs',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
  },
};
