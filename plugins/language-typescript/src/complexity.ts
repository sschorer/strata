import type { Node } from 'web-tree-sitter';

/**
 * A decision point is anything that adds a path through the code.
 *
 * `else` and `default` add none — they are the fall-through of a branch that is
 * already counted — and `do … while` is counted once, by the `do_statement`
 * itself. `for_in_statement` covers both `for … in` and `for … of`.
 */
const DECISION_NODES = [
  'if_statement',
  'for_statement',
  'for_in_statement',
  'while_statement',
  'do_statement',
  'catch_clause',
  'switch_case',
  'ternary_expression',
  'binary_expression',
  'augmented_assignment_expression',
];

/**
 * Operators that branch: the right-hand side runs only for some values of the
 * left. Every other binary operator is arithmetic and adds no path.
 */
const SHORT_CIRCUIT = new Set(['&&', '||', '??', '&&=', '||=', '??=']);

/**
 * McCabe cyclomatic complexity of one file: one path through it, plus one per
 * decision point. Whole-file rather than per-function — the file is the unit
 * the graph, the hotspot map and the dead-code table all address, so the
 * numbers stay comparable.
 *
 * Counting nodes rather than tokens is what makes the number exact: a `case` in
 * a comment, an `&&` in a string and the `?` of an optional parameter are not
 * nodes of these kinds, and neither is a conditional *type* (`T extends U ? …`),
 * which branches the type checker rather than the program.
 */
export function cyclomaticComplexity(root: Node): number {
  const points = root
    .descendantsOfType(DECISION_NODES)
    .filter((node) => !isOperator(node) || isShortCircuit(node));
  return 1 + points.length;
}

function isOperator(node: Node): boolean {
  return (
    node.type === 'binary_expression' ||
    node.type === 'augmented_assignment_expression'
  );
}

function isShortCircuit(node: Node): boolean {
  const operator = node.childForFieldName('operator');
  return operator !== null && SHORT_CIRCUIT.has(operator.text);
}
