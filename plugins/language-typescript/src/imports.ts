import { clauseNames } from './clause.js';

/**
 * One place a module is pulled in — `import`, `export … from`, `require`, or a
 * dynamic `import()`.
 *
 * Dead-code analysis needs more than the specifier the graph is built from: an
 * export is dead when no other file asks for *that name*, so every site has to
 * say what it takes, not only where from.
 */
export interface ImportSite {
  /** The specifier exactly as written: `./x.js`, `node:path`, `lodash/merge`. */
  spec: string;
  /** Names taken from the module; `default` stands for the default export. */
  names: string[];
  /**
   * The whole module object is taken — `import * as ns`, `require(…)`, a
   * dynamic `import()`. Every name the target exports then counts as used,
   * because nothing here says which properties are read.
   */
  namespace: boolean;
}

/**
 * `import` up to its specifier. The clause is lazy and may not contain `;`,
 * `=` or a quote, so a stray `import` keyword can never swallow the rest of the
 * file looking for a string; `(?!\s*\.)` keeps `import.meta` out.
 */
const IMPORT_RE =
  /(?<![.\w$])import\b(?!\s*\.)(?:\s+type\b)?([^;'"=]*?)(?:\bfrom\b\s*)?(['"])([^'"\n]+)\2/g;

const REQUIRE_RE =
  /(?<![.\w$])require\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;

/**
 * Every module `code` pulls in.
 *
 * Expects text that went through `stripComments`: commented-out imports are a
 * fixture of real repositories and must not register as edges, while the
 * specifiers themselves *are* string literals and have to survive.
 */
export function parseImports(code: string): ImportSite[] {
  const sites: ImportSite[] = [];

  for (const match of code.matchAll(IMPORT_RE)) {
    sites.push({ spec: match[3]!, ...bindings(match[1] ?? '') });
  }
  for (const match of code.matchAll(REQUIRE_RE)) {
    sites.push({ spec: match[2]!, names: [], namespace: true });
  }

  return sites;
}

/** What an import clause takes: `a, { b as c }`, `* as ns`, `(` for `import()`. */
function bindings(clause: string): Pick<ImportSite, 'names' | 'namespace'> {
  const text = clause.trim();
  // A dynamic `import()` hands back the whole module object.
  if (text.startsWith('(')) return { names: [], namespace: true };
  // `import './x.js'` — run for its side effects, takes nothing.
  if (text === '') return { names: [], namespace: false };

  const names = clauseNames(braced(text)).map((n) => n.source);
  const outside = text.replace(/\{[^}]*\}/g, ' ');
  const withoutStar = outside.replace(/\*(\s*as\s+[\w$]+)?/g, ' ');
  // Whatever is left outside the braces and the star is the default binding.
  if (/[\w$]/.test(withoutStar)) names.push('default');

  return { names, namespace: outside.includes('*') };
}

/** The inside of the clause's `{ … }`, or nothing. */
function braced(clause: string): string {
  return clause.match(/\{([^}]*)\}/)?.[1] ?? '';
}
