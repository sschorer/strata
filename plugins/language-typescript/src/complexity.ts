/**
 * A decision point is anything that adds a path through the code.
 *
 * `else` and `default` add none — they are the fall-through of a branch that is
 * already counted — and `do … while` is counted once, by its `while`. The last
 * alternative is the ternary `?`; everything else a `?` can be in TypeScript is
 * excluded by the lookahead: `??`, `?.`, and an optional parameter or property
 * (`a?: T`, `a?, b`, `a?)`).
 */
const DECISION_POINT =
  /\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|\?(?![?.:,)\]])/g;

/**
 * McCabe cyclomatic complexity of one file: one path through it, plus one per
 * decision point. Whole-file rather than per-function — the file is the unit
 * the graph, the hotspot map and the dead-code table all address, so the
 * numbers stay comparable.
 *
 * Expects text that already went through `stripNonCode`; run on raw source it
 * would count the `if` in every comment.
 */
export function cyclomaticComplexity(code: string): number {
  return 1 + (code.match(DECISION_POINT)?.length ?? 0);
}
