/** Keywords whose `(…)` head is followed by the block they control. */
const HEAD_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch']);

/** Keywords that open their block directly, with no head in between. */
const BARE_KEYWORDS = new Set(['else', 'do', 'try', 'finally']);

/**
 * Deepest nesting of control-flow blocks in one file.
 *
 * Complexity counts branches; nesting says how tangled they are — twelve flat
 * `if`s read fine, four nested ones do not. Only control blocks count: function
 * bodies, classes and object literals are structure, not depth, so a method
 * three classes deep still reports 0 until it branches.
 *
 * Expects text that already went through `stripNonCode` — a brace inside a
 * string would otherwise shift every level after it.
 */
export function maxNesting(code: string): number {
  /** One entry per open brace: does it hold a control block? */
  const blocks: boolean[] = [];
  let depth = 0;
  let max = 0;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (ch === '{') {
      const control = opensControlBlock(code, i);
      blocks.push(control);
      if (control && ++depth > max) max = depth;
    } else if (ch === '}' && blocks.pop()) depth--;
  }

  return max;
}

/** Is the brace at `brace` the body of an `if`/`for`/`else`/…? */
function opensControlBlock(code: string, brace: number): boolean {
  const before = skipSpaceBack(code, brace - 1);
  if (code[before] === ')') {
    const head = skipSpaceBack(code, beforeMatchingParen(code, before));
    return HEAD_KEYWORDS.has(wordEndingAt(code, head));
  }
  return BARE_KEYWORDS.has(wordEndingAt(code, before));
}

/** Index just before the `(` matching the `)` at `close`. */
function beforeMatchingParen(code: string, close: number): number {
  let open = 1;
  let i = close - 1;
  for (; i >= 0 && open > 0; i--) {
    if (code[i] === ')') open++;
    else if (code[i] === '(') open--;
  }
  return i;
}

function skipSpaceBack(code: string, from: number): number {
  let i = from;
  while (i >= 0 && /\s/.test(code[i]!)) i--;
  return i;
}

/** The identifier ending at `end`, or "" if that isn't a word character. */
function wordEndingAt(code: string, end: number): string {
  if (end < 0 || !/[\w$]/.test(code[end]!)) return '';
  let start = end;
  while (start > 0 && /[\w$]/.test(code[start - 1]!)) start--;
  return code.slice(start, end + 1);
}
