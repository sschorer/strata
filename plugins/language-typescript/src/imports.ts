import type { Node } from 'web-tree-sitter';
import { staticString } from './literal.js';

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

/** The statements and calls that can name another module. */
const IMPORTING = ['import_statement', 'call_expression'];

/**
 * Every module `root` pulls in.
 *
 * The whole tree is searched, not only its top level: a dynamic `import()` or a
 * `require()` sits wherever it is called — inside a function, a branch, a lazily
 * loaded route — and it pulls a module in exactly as a top-level `import` does.
 * Re-exports (`export { a } from './x'`) are imports too, but they arrive from
 * the export parser, which already has to visit them.
 */
export function parseImports(root: Node): ImportSite[] {
  const sites: ImportSite[] = [];

  for (const node of root.descendantsOfType(IMPORTING)) {
    const site =
      node.type === 'import_statement' ? importStatement(node) : moduleCall(node);
    if (site) sites.push(site);
  }

  return sites;
}

/** `import … from './x'` in all its forms, including `import x = require(…)`. */
function importStatement(node: Node): ImportSite | undefined {
  const clause = node.namedChildren.find(
    (child) =>
      child.type === 'import_clause' || child.type === 'import_require_clause',
  );

  // `import x = require('./x.js')` keeps its specifier inside the clause, and
  // binds the whole module object the way the call it stands for would.
  if (clause?.type === 'import_require_clause') {
    const spec = staticString(clause.childForFieldName('source'));
    return spec === undefined ? undefined : { spec, names: [], namespace: true };
  }

  const spec = staticString(node.childForFieldName('source'));
  if (spec === undefined) return undefined;
  // `import './x.js'` is run for its side effects and takes nothing.
  if (!clause) return { spec, names: [], namespace: false };
  return { spec, ...bindings(clause) };
}

/** What an `import_clause` takes: `a`, `{ b as c }`, `* as ns`, or a mix. */
function bindings(clause: Node): Pick<ImportSite, 'names' | 'namespace'> {
  const names: string[] = [];
  let namespace = false;

  for (const child of clause.namedChildren) {
    if (child.type === 'namespace_import') namespace = true;
    // The bare identifier of the clause is the default binding.
    else if (child.type === 'identifier') names.push('default');
    else if (child.type === 'named_imports') {
      for (const specifier of child.namedChildren) {
        // `name` is what the *other* module calls it; `alias` is local and no
        // concern of the file that owns the export.
        const name = specifier.childForFieldName('name');
        if (name) names.push(name.text);
      }
    }
  }

  return { names, namespace };
}

/** `import('./x.js')` and `require('./x.js')` — both take the whole module. */
function moduleCall(node: Node): ImportSite | undefined {
  const callee = node.childForFieldName('function');
  if (!callee) return undefined;
  if (callee.type !== 'import' && callee.text !== 'require') return undefined;

  const spec = staticString(node.childForFieldName('arguments')?.namedChild(0) ?? null);
  return spec === undefined ? undefined : { spec, names: [], namespace: true };
}
