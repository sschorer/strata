import type { Node } from 'web-tree-sitter';

/**
 * The text of a static string, or nothing when the value is only known at
 * runtime.
 *
 * Module specifiers are the only strings this plugin reads, and a specifier
 * that is not a literal — `import(\`./locales/${lang}.js\`)`, `require(name)` —
 * names no single file, so there is no edge to draw. A template *without*
 * substitutions is as static as a quoted string and counts.
 *
 * Fragments are taken verbatim, so a specifier containing an escape sequence
 * counts as unknown rather than being unescaped here — no real import writes
 * one, and a half-correct unescaper would only add a way to be wrong.
 */
export function staticString(node: Node | null): string | undefined {
  if (!node) return undefined;
  if (node.type !== 'string' && node.type !== 'template_string') return undefined;

  let text = '';
  for (const child of node.namedChildren) {
    if (child.type !== 'string_fragment') return undefined; // an interpolation
    text += child.text;
  }
  return text;
}
