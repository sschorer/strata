/** One entry of a braced import/export list: `a`, `a as b`, `type T`. */
export interface ClauseName {
  /** The name the *other* module knows it by — the left side of `as`. */
  source: string;
  /** The name this file knows it by — the right side of `as`. */
  local: string;
  /** Offset of `source` within the clause text, for line numbers. */
  at: number;
}

/**
 * Split the inside of a `{ … }` clause into its names.
 *
 * Shared by both parsers because the syntax is shared: `import { a as b }` and
 * `export { a as b }` name the same two sides, they only differ in which side
 * the caller cares about. An import *uses* `source`; an export *offers*
 * `local`.
 */
export function clauseNames(list: string): ClauseName[] {
  const names: ClauseName[] = [];
  let at = 0;

  for (const part of list.split(',')) {
    const entry = part.trim();
    if (entry) {
      // `type` is a modifier, not a name; drop it but keep the offset honest.
      const body = entry.replace(/^type\s+/, '');
      const lead = part.length - part.trimStart().length;
      const [source = '', local = source] = body.split(/\s+as\s+/);
      if (source) {
        names.push({
          source: source.trim(),
          local: local.trim(),
          at: at + lead + (entry.length - body.length),
        });
      }
    }
    at += part.length + 1; // + the comma the split removed
  }

  return names;
}
