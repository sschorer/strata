/**
 * The globs a project's *Scope & ignore* lists are written in, compiled to one
 * predicate over repo-relative paths.
 *
 * `*` and `?` stay inside a path segment and `**` crosses them. A `**` segment
 * may also stand for no directory at all, so `**` + `/*.test.ts` covers
 * `src/a.test.ts` and `a.test.ts` alike. A pattern matches everything *below*
 * what it names as well, so `dist` is the build directory and not only a file
 * that happens to be called `dist` — someone excluding a directory should not
 * have to know to write it as a wildcard to mean it.
 *
 * `null` comes back when the list constrains nothing, because an empty list of
 * globs means "no restriction" everywhere it is used, and a predicate that
 * matched nothing would read as its opposite.
 */
export function globMatcher(
  patterns: readonly string[] | null | undefined,
): ((path: string) => boolean) | null {
  const expressions = (patterns ?? [])
    .map(normalise)
    .filter(Boolean)
    .map(toRegExp);
  if (expressions.length === 0) return null;
  return (path) => expressions.some((re) => re.test(normalise(path)));
}

/**
 * A chip list is typed by hand, so `./src`, `/src` and `src/` all arrive
 * meaning `src`. Paths are compared in the same shape.
 */
function normalise(pattern: string): string {
  return pattern.trim().replace(/^\.?\/+/, '').replace(/\/+$/, '');
}

function toRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === '?') {
      source += '[^/]';
      continue;
    }
    if (char !== '*') {
      source += escape(char);
      continue;
    }
    if (glob[i + 1] !== '*') {
      source += '[^/]*';
      continue;
    }
    i++;
    // A `**` segment is any run of whole directories, including none of them.
    if (glob[i + 1] === '/') {
      i++;
      source += '(?:[^/]*/)*';
    } else {
      source += '.*';
    }
  }
  // The trailing group is what makes a pattern cover the tree under it.
  return new RegExp(`^(?:${source})(?:/.*)?$`);
}

const SPECIAL = /[.+^${}()|[\]\\]/;

function escape(char: string): string {
  return SPECIAL.test(char) ? `\\${char}` : char;
}
