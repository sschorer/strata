import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { Language, Parser, type Node } from 'web-tree-sitter';

const require = createRequire(import.meta.url);

/**
 * The two grammars that cover everything this plugin claims, and the
 * pre-built WebAssembly they are loaded from.
 *
 * WASM rather than the native bindings on purpose: a language module must
 * install on any platform the server runs on, and `node-gyp` in a slim Docker
 * image is exactly the kind of build step a drop-in plugin cannot ask for.
 */
const WASM = {
  typescript: '@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm',
  tsx: '@vscode/tree-sitter-wasm/wasm/tree-sitter-tsx.wasm',
} as const;

type Grammar = keyof typeof WASM;

/**
 * Extensions that must be parsed *without* JSX.
 *
 * The two grammars disagree about `<T>x`: in `.ts` it is a type assertion, in
 * `.tsx` it opens an element. Everything else — `.tsx` itself, and the `.js`
 * family, where JSX is common and a type assertion is impossible — is safer
 * under the JSX grammar.
 */
const NO_JSX = new Set(['.ts', '.mts', '.cts']);

/** Loading the runtime and both grammars happens once per process. */
let loading: Promise<Record<Grammar, Parser>> | undefined;

async function parsers(): Promise<Record<Grammar, Parser>> {
  return (loading ??= load());
}

async function load(): Promise<Record<Grammar, Parser>> {
  await Parser.init();
  const loaded = await Promise.all(
    Object.entries(WASM).map(async ([name, wasm]) => {
      const parser = new Parser();
      parser.setLanguage(await Language.load(await readFile(require.resolve(wasm))));
      return [name, parser] as const;
    }),
  );
  return Object.fromEntries(loaded) as Record<Grammar, Parser>;
}

/**
 * Parse one file and hand its syntax tree to `read`.
 *
 * The tree is not returned, because it must not outlive the call: it lives in
 * the WebAssembly heap, which the JavaScript garbage collector cannot reach, so
 * a run over a large repository leaks until the process ends unless every tree
 * is released. Callers get the root node for as long as they are inside `read`.
 *
 * Parsing never throws on broken input — tree-sitter recovers and marks the
 * damaged region `ERROR`, so a file mid-edit still yields the imports and
 * exports around it.
 */
export async function withSyntaxTree<T>(
  path: string,
  text: string,
  read: (root: Node) => T,
): Promise<T> {
  const grammar: Grammar = NO_JSX.has(extname(path)) ? 'typescript' : 'tsx';
  const tree = (await parsers())[grammar].parse(text);
  if (!tree) throw new Error(`could not parse ${path}`);
  try {
    return read(tree.rootNode);
  } finally {
    tree.delete();
  }
}
