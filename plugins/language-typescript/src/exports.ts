import { clauseNames } from './clause.js';
import type { ImportSite } from './imports.js';

/** One name a file offers to the rest of the repository. */
export interface ExportSite {
  /** The exported name; `default` for a default export. */
  name: string;
  /** 1-based line the name sits on — what the dead-code table links to. */
  line: number;
}

/** What the `export` statements of one file amount to. */
export interface FileExports {
  /** Names this file offers to other modules. */
  exports: ExportSite[];
  /** Names it takes from other modules on the way (`export { a } from './x'`). */
  uses: ImportSite[];
  /**
   * `export * from './x'` specifiers. A star names nothing, so it cannot be
   * resolved here: whether it keeps `./x`'s exports alive depends on what the
   * files *importing this barrel* ask for.
   */
  stars: string[];
}

const MODIFIERS = String.raw`(?:declare\s+|abstract\s+|async\s+)*`;
const DECLARED =
  String.raw`(?:function\s*\*?|class|interface|type|enum|namespace|const\s+enum|const|let|var)`;

/** `export function f`, `export const enum E`, `export abstract class C`, … */
const DECLARED_RE = new RegExp(
  String.raw`(?<![.\w$])export\s+(default\s+)?${MODIFIERS}${DECLARED}\s+([\w$]+)`,
  'g',
);

/** Both `export default class C` and `export default someExpression`. */
const DEFAULT_RE = /(?<![.\w$])export\s+default\b/g;

/** `export { a, b as c }`, `export * from './x'`, `export * as ns from './x'`. */
const CLAUSE_RE =
  /(?<![.\w$])export\s+(?:type\s+)?(?:\*(?:\s+as\s+([\w$]+))?|\{([^}]*)\})\s*(?:from\s*(['"])([^'"\n]+)\3)?/g;

/**
 * Every name `code` exports, and every name it re-exports from elsewhere.
 *
 * Expects text that went through `stripComments`, for the same reason the
 * import parser does — a commented-out `export` is not an export, and the
 * `from` specifier is a live string literal.
 */
export function parseExports(code: string): FileExports {
  const lineOf = lineCounter(code);
  const exports: ExportSite[] = [];
  const uses: ImportSite[] = [];
  const stars: string[] = [];

  for (const match of code.matchAll(DECLARED_RE)) {
    // `export default function f` is imported as the default, never as `f`,
    // so DEFAULT_RE below is the one that records it.
    if (!match[1]) exports.push({ name: match[2]!, line: lineOf(match.index) });
  }
  for (const match of code.matchAll(DEFAULT_RE)) {
    exports.push({ name: 'default', line: lineOf(match.index) });
  }

  for (const match of code.matchAll(CLAUSE_RE)) {
    const [, alias, list, , spec] = match;

    if (list !== undefined) {
      const at = match.index + match[0].indexOf('{') + 1;
      const names = clauseNames(list);
      for (const name of names) {
        exports.push({ name: name.local, line: lineOf(at + name.at) });
      }
      // `export { a } from './x'` is an import as much as an export: it takes
      // `a` out of `./x` even though nothing in this file mentions it again.
      if (spec) {
        uses.push({
          spec,
          names: names.map((n) => n.source),
          namespace: false,
        });
      }
      continue;
    }

    if (!spec) continue; // `export *` without a source is not valid syntax
    if (alias) {
      // `export * as ns from './x'` publishes one name and consumes the whole
      // module to build it.
      exports.push({ name: alias, line: lineOf(match.index) });
      uses.push({ spec, names: [], namespace: true });
    } else {
      stars.push(spec);
    }
  }

  return { exports, uses, stars };
}

/** Index → 1-based line, by binary search over the line starts. */
function lineCounter(code: string): (index: number) => number {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') starts.push(i + 1);
  }

  return (index) => {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (starts[mid]! <= index) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  };
}
