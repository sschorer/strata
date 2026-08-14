import type { Node } from 'web-tree-sitter';
import type { ImportSite } from './imports.js';
import { staticString } from './literal.js';

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

/**
 * Every name `root` exports, and every name it re-exports from elsewhere.
 *
 * Only the module's own top level is read. An `export` inside `namespace N` or
 * `declare module 'x'` belongs to that block — importers reach it through `N`,
 * never by its own name — so counting it would invent an export nobody can ask
 * for, and then report it as dead.
 */
export function parseExports(root: Node): FileExports {
  const found: FileExports = { exports: [], uses: [], stars: [] };
  for (const node of root.namedChildren) {
    if (node.type === 'export_statement') readExport(node, found);
  }
  return found;
}

function readExport(node: Node, found: FileExports): void {
  const spec = staticString(node.childForFieldName('source'));
  const clause = node.namedChildren.find(
    (child) => child.type === 'export_clause' || child.type === 'namespace_export',
  );

  if (clause?.type === 'export_clause') {
    readClause(clause, spec, found);
    return;
  }
  if (clause?.type === 'namespace_export') {
    // `export * as ns from './x'` publishes one name and consumes the whole
    // module to build it.
    const alias = clause.namedChildren[0];
    if (alias) found.exports.push(site(alias.text, alias));
    if (spec !== undefined) found.uses.push({ spec, names: [], namespace: true });
    return;
  }

  const declaration = node.childForFieldName('declaration');
  // `export default …` is imported under that name whatever it declares, so a
  // named function or class behind it never offers its own name.
  if (isDefault(node)) {
    found.exports.push(site('default', node));
    return;
  }
  if (declaration) {
    for (const name of declaredNames(declaration)) {
      found.exports.push(site(name.text, name));
    }
    return;
  }
  // Nothing but a source left: `export * from './x'`. `export = x` declares no
  // name an ESM importer can ask for and is skipped with it.
  if (spec !== undefined) found.stars.push(spec);
}

/** `export { a, b as c }`, with or without a `from`. */
function readClause(clause: Node, spec: string | undefined, found: FileExports): void {
  const names: string[] = [];

  for (const specifier of clause.namedChildren) {
    const name = specifier.childForFieldName('name');
    if (!name) continue;
    // The two sides face opposite ways: the alias is what this file offers, the
    // name is what it asks the other module for.
    const alias = specifier.childForFieldName('alias') ?? name;
    found.exports.push(site(alias.text, alias));
    names.push(name.text);
  }

  // `export { a } from './x'` is an import as much as an export: it takes `a`
  // out of `./x` even though nothing in this file mentions it again.
  if (spec !== undefined) found.uses.push({ spec, names, namespace: false });
}

/** Does the statement carry the `default` keyword? */
function isDefault(node: Node): boolean {
  return node.children.some((child) => child.type === 'default');
}

/**
 * The names one exported declaration introduces.
 *
 * A declaration can bind more than one: `export const a = 1, b = 2` offers
 * both, and `export const { x, y: z } = obj` offers the names the pattern
 * binds, not the object it destructures.
 */
function declaredNames(declaration: Node): Node[] {
  switch (declaration.type) {
    // `export declare const k: number` — the ambient wrapper holds the real one.
    case 'ambient_declaration':
      return declaration.namedChildren.flatMap(declaredNames);
    case 'lexical_declaration':
    case 'variable_declaration':
      return declaration.namedChildren
        .filter((child) => child.type === 'variable_declarator')
        .flatMap((declarator) => boundNames(declarator.childForFieldName('name')));
    default: {
      const name = declaration.childForFieldName('name');
      return name ? [name] : [];
    }
  }
}

/** Every identifier a binding pattern introduces. */
function boundNames(pattern: Node | null): Node[] {
  if (!pattern) return [];
  switch (pattern.type) {
    case 'identifier':
    case 'shorthand_property_identifier_pattern':
      return [pattern];
    // `{ y: z }` binds `z`, `{ y = 1 }` and `[y = 1]` bind `y`.
    case 'pair_pattern':
      return boundNames(pattern.childForFieldName('value'));
    case 'object_assignment_pattern':
    case 'assignment_pattern':
      return boundNames(pattern.childForFieldName('left'));
    case 'object_pattern':
    case 'array_pattern':
    case 'rest_pattern':
      return pattern.namedChildren.flatMap(boundNames);
    default:
      return [];
  }
}

function site(name: string, at: Node): ExportSite {
  return { name, line: at.startPosition.row + 1 };
}
