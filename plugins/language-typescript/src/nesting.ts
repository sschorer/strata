import type { Node } from 'web-tree-sitter';

/** Structures whose body is one level deeper than the code around them. */
const CONTROL = new Set([
  'if_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'do_statement',
  'switch_statement',
  'try_statement',
  'catch_clause',
  'finally_clause',
  'else_clause',
]);

/**
 * Deepest nesting of control flow in one file.
 *
 * Complexity counts branches; nesting says how tangled they are — twelve flat
 * `if`s read fine, four nested ones do not. Only control flow counts: function
 * bodies, classes and object literals are structure, not depth, so a method
 * three classes deep still reports 0 until it branches. Braces are irrelevant,
 * which is the point of measuring the tree — `if (a) return;` nests exactly as
 * much as the same branch written out.
 */
export function maxNesting(root: Node): number {
  let max = 0;

  const visit = (node: Node, depth: number): void => {
    const inner = depth + (opensLevel(node) ? 1 : 0);
    if (inner > max) max = inner;
    for (const child of node.namedChildren) {
      // A continuation is a sibling of the clause it belongs to, not a nest
      // inside it: `try`/`catch`/`finally` are three blocks at one level, and
      // an `else if` chain stays flat however long it runs.
      visit(child, continues(node, child) ? depth : inner);
    }
  };

  visit(root, 0);
  return max;
}

function opensLevel(node: Node): boolean {
  if (!CONTROL.has(node.type)) return false;
  // `else if` is one `if` after another, so the `else` opens nothing and the
  // `if` it holds does the counting.
  if (node.type === 'else_clause') {
    return node.namedChildren[0]?.type !== 'if_statement';
  }
  return true;
}

/** Does `child` continue `parent` at the same level rather than nest in it? */
function continues(parent: Node, child: Node): boolean {
  if (parent.type === 'if_statement') return child.type === 'else_clause';
  if (parent.type === 'try_statement') {
    return child.type === 'catch_clause' || child.type === 'finally_clause';
  }
  return false;
}
