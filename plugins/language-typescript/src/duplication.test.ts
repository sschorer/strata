import { describe, expect, it } from 'vitest';
import { blankComments } from './comments.js';
import { duplicationByPath, type FilePrints } from './duplication.js';
import { CLONE_WINDOW, fingerprint } from './fingerprint.js';
import { withSyntaxTree } from './parser.js';

/** A block of `n` distinct, long-enough-to-count lines. */
const block = (tag: string, n: number): string =>
  Array.from({ length: n }, (_, i) => `const ${tag}${i} = value(${i});`).join(
    '\n',
  );

/** Fingerprint the way `scan.ts` does, so the tests exercise the real input. */
const prints = (path: string, code: string): Promise<FilePrints> =>
  withSyntaxTree(path, code, (root) => ({
    path,
    ...fingerprint(blankComments(root, code)),
  }));

describe('fingerprint', () => {
  it('needs a full window before it emits anything', () => {
    expect(fingerprint(block('a', CLONE_WINDOW - 1)).prints).toHaveLength(0);
    expect(fingerprint(block('a', CLONE_WINDOW)).prints).toHaveLength(1);
    expect(fingerprint(block('a', CLONE_WINDOW + 2)).prints).toHaveLength(3);
  });

  it('ignores indentation and blank lines, so a re-indented copy still matches', () => {
    const plain = fingerprint(block('a', CLONE_WINDOW));
    const indented = fingerprint(
      block('a', CLONE_WINDOW)
        .split('\n')
        .map((l) => `      ${l}\n`)
        .join('\n'),
    );

    expect(indented.prints).toEqual(plain.prints);
  });

  it('drops punctuation-only lines', () => {
    expect(fingerprint('}\n};\n});\n{\n').lines).toBe(0);
  });
});

describe('duplicationByPath', () => {
  it('is 0 when nothing is shared', async () => {
    const files = [
      await prints('a.ts', block('a', 20)),
      await prints('b.ts', block('b', 20)),
    ];

    expect(duplicationByPath(files).get('a.ts')).toBe(0);
    expect(duplicationByPath(files).get('b.ts')).toBe(0);
  });

  it('is 1 for a file copied wholesale', async () => {
    const body = block('a', 12);
    const dup = duplicationByPath([
      await prints('a.ts', body),
      await prints('b.ts', body),
    ]);

    expect(dup.get('a.ts')).toBe(1);
    expect(dup.get('b.ts')).toBe(1);
  });

  it('reports the duplicated share of a partly copied file', async () => {
    const shared = block('s', CLONE_WINDOW);
    const dup = duplicationByPath([
      await prints('a.ts', `${shared}\n${block('a', CLONE_WINDOW)}`),
      await prints('b.ts', shared),
    ]);

    // The shared half matches; the file's own half does not.
    expect(dup.get('a.ts')).toBe(0.5);
    expect(dup.get('b.ts')).toBe(1);
  });

  it('counts a block a file repeats within itself', async () => {
    const body = block('a', CLONE_WINDOW);
    const dup = duplicationByPath([await prints('a.ts', `${body}\n${body}`)]);

    expect(dup.get('a.ts')).toBe(1);
  });

  it('does not call a barrel of re-exports a clone of itself', async () => {
    const barrel = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map((m) => `export * from './${m}.js';`)
      .join('\n');

    const dup = duplicationByPath([await prints('index.ts', barrel)]);

    expect(dup.get('index.ts')).toBe(0);
  });

  it('sees through rewritten comments but not through different literals', async () => {
    const body = block('a', CLONE_WINDOW);
    const recommented = `// a different comment\n${body}`;
    const relabelled = body.replaceAll('value(', 'other(');
    const dup = duplicationByPath([
      await prints('a.ts', body),
      await prints('b.ts', recommented),
      await prints('c.ts', relabelled),
    ]);

    expect(dup.get('a.ts')).toBe(1);
    expect(dup.get('b.ts')).toBe(1);
    expect(dup.get('c.ts')).toBe(0);
  });

  it('reports 0 for a file with no windows at all', async () => {
    const dup = duplicationByPath([await prints('tiny.ts', 'export {};')]);

    expect(dup.get('tiny.ts')).toBe(0);
  });
});
