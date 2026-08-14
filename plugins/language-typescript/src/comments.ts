import type { Node } from 'web-tree-sitter';

/**
 * The file's text with every comment blanked — each character replaced by a
 * space, newlines kept — so the result lines up with the original line for line.
 *
 * What duplication compares: two files that differ only in their header comment
 * are copies, while two lines that differ only in a string — `export * from
 * './a.js'` and `'./b.js'` — are not. Literals therefore stay; only the
 * comments go, and the tree says exactly where they are, including the ones a
 * lexer has to guess at (a `//` inside a URL, a `/*` inside a regex).
 */
export function blankComments(root: Node, text: string): string {
  let out = '';
  let at = 0;

  for (const comment of root.descendantsOfType('comment')) {
    out += text.slice(at, comment.startIndex);
    out += text.slice(comment.startIndex, comment.endIndex).replace(/[^\n]/g, ' ');
    at = comment.endIndex;
  }

  return out + text.slice(at);
}
