/**
 * Parse the JSON dialect `tsconfig.json` is written in: comments and trailing
 * commas allowed. Returns nothing when the text is not usable JSON after that.
 *
 * `JSON.parse` rejects both, and a project's aliases live in a file that
 * conventionally explains itself in comments — refusing to read those would
 * mean refusing to resolve half the repositories that have aliases at all.
 */
export function parseJsonc(text: string): unknown {
  try {
    return JSON.parse(plainJson(text));
  } catch {
    return undefined;
  }
}

/**
 * Blank the comments and the trailing commas, leaving the offsets untouched.
 *
 * One pass, because both need the same thing: knowing whether the cursor is
 * inside a string. A `//` in a path value is not a comment, and a comma inside
 * one is not a separator.
 */
function plainJson(text: string): string {
  const out = [...text];
  /** Index of the last comma that could still turn out to be trailing. */
  let comma = -1;
  let i = 0;

  const blank = (from: number, to: number): number => {
    for (let j = from; j < Math.min(to, out.length); j++) {
      if (out[j] !== '\n') out[j] = ' ';
    }
    return Math.min(to, text.length);
  };

  while (i < text.length) {
    const ch = text[i]!;

    if (ch === '"') {
      i = endOfString(text, i);
      comma = -1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      i = blank(i, end === -1 ? text.length : end);
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = blank(i, end === -1 ? text.length : end + 2);
      continue;
    }

    if (ch === ',') comma = i;
    else if (ch === '}' || ch === ']') {
      if (comma !== -1) out[comma] = ' ';
      comma = -1;
    } else if (!/\s/.test(ch)) comma = -1;
    i++;
  }

  return out.join('');
}

/** Index just past the closing quote of the string starting at `start`. */
function endOfString(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}
