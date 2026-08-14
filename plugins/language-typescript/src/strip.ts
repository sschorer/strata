/**
 * Characters that cannot end an expression, so a `/` after one opens a regex
 * literal rather than dividing. The classic disambiguation heuristic.
 */
const BEFORE_REGEX = new Set([
  '(',
  '[',
  '{',
  ',',
  ';',
  ':',
  '=',
  '!',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '~',
  '?',
]);

/** Keywords a regex literal may directly follow (`return /x/`, `case /x/`). */
const BEFORE_REGEX_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'throw',
]);

/**
 * Blank out everything that is not code — comments, string and template
 * literals, regex bodies — replacing each character with a space and keeping
 * newlines, so the result lines up with the original line for line.
 *
 * Counting syntax in raw text lies: an `if` in a doc comment, a `//` inside a
 * URL, an unbalanced brace in a message string. Complexity and nesting
 * therefore measure this. Template *interpolations* survive — `${a ? b : c}`
 * really is a branch — only the literal parts around them go.
 */
export function stripNonCode(source: string): string {
  return strip(source, false);
}

/**
 * Blank the comments and leave every literal in place.
 *
 * What duplication compares: two files that differ only in their header comment
 * are copies, while two lines that differ only in a string — `export * from
 * './a.js'` and `'./b.js'` — are not. Blanking literals for this pass would
 * report every barrel file in the repo as a wholesale clone.
 */
export function stripComments(source: string): string {
  return strip(source, true);
}

/**
 * The shared lexer. It knows tokens, not structure — enough for the metrics,
 * and it keeps the plugin dependency-free until tree-sitter lands. Literals are
 * always *recognised* (a `//` inside a string is not a comment); `keepLiterals`
 * only decides whether their characters survive.
 */
function strip(source: string, keepLiterals: boolean): string {
  const out: string[] = [];
  /** Blank `[from, to)` and return the new cursor. */
  const blank = (from: number, to: number): number => {
    const end = Math.min(to, source.length);
    for (let i = from; i < end; i++) out.push(source[i] === '\n' ? '\n' : ' ');
    return end;
  };
  /** Same span, kept verbatim. */
  const copy = (from: number, to: number): number => {
    const end = Math.min(to, source.length);
    for (let i = from; i < end; i++) out.push(source[i]!);
    return end;
  };
  const literal = keepLiterals ? copy : blank;

  /** Brace depth inside each open `${…}`; empty while in plain code. */
  const interpolations: number[] = [];
  let inTemplate = false;
  let i = 0;

  while (i < source.length) {
    const ch = source[i]!;

    if (inTemplate) {
      if (ch === '\\') i = literal(i, i + 2);
      else if (ch === '`') {
        inTemplate = false;
        i = literal(i, i + 1);
      } else if (ch === '$' && source[i + 1] === '{') {
        interpolations.push(0);
        inTemplate = false;
        i = literal(i, i + 2);
      } else i = literal(i, i + 1);
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      i = blank(i, end === -1 ? source.length : end);
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      i = blank(i, end === -1 ? source.length : end + 2);
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = literal(i, endOfString(source, i, ch));
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      i = literal(i, i + 1);
      continue;
    }
    if (ch === '/' && startsRegex(source, i)) {
      i = literal(i, endOfRegex(source, i));
      continue;
    }

    // The `${` of the enclosing interpolation is not a brace the loop can see
    // (blanked, or part of the literal), so its `}` is found by counting.
    const open = interpolations.length - 1;
    if (open >= 0 && (ch === '{' || ch === '}')) {
      if (ch === '{') interpolations[open]!++;
      else if (interpolations[open] === 0) {
        interpolations.pop();
        inTemplate = true;
        i = literal(i, i + 1);
        continue;
      } else interpolations[open]!--;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}

/** Index just past the closing quote — or the line end, if unterminated. */
function endOfString(source: string, start: number, quote: string): number {
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '\\') i++;
    else if (ch === quote) return i + 1;
    else if (ch === '\n') return i; // don't let one bad quote eat the file
  }
  return source.length;
}

/** Index just past a regex literal's closing `/` and its flags. */
function endOfRegex(source: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < source.length; i++) {
    const ch = source[i]!;
    if (ch === '\\') i++;
    else if (ch === '\n') return i;
    else if (inClass) inClass = ch !== ']';
    else if (ch === '[') inClass = true;
    else if (ch === '/') {
      let end = i + 1;
      while (end < source.length && /[a-z]/i.test(source[end]!)) end++;
      return end;
    }
  }
  return source.length;
}

/** Does the `/` at `at` open a regex literal, or is it a division? */
function startsRegex(source: string, at: number): boolean {
  let i = at - 1;
  while (i >= 0 && /\s/.test(source[i]!)) i--;
  if (i < 0) return true;

  const ch = source[i]!;
  if (BEFORE_REGEX.has(ch)) return true;
  if (!/[\w$]/.test(ch)) return false;

  const end = i + 1;
  while (i >= 0 && /[\w$]/.test(source[i]!)) i--;
  return BEFORE_REGEX_KEYWORDS.has(source.slice(i + 1, end));
}
