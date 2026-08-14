import { describe, expect, it } from 'vitest';
import { duplicationByPath } from './duplication.js';
import { CLONE_WINDOW, fingerprint } from './fingerprint.js';
import { stripComments } from './strip.js';

/** A block of `n` distinct, long-enough-to-count lines. */
const block = (tag: string, n: number): string =>
  Array.from({ length: n }, (_, i) => `const ${tag}${i} = value(${i});`).join(
    '\n',
  );

/** Fingerprint the way `scan.ts` does, so the tests exercise the real input. */
const prints = (path: string, code: string) => ({
  path,
  ...fingerprint(stripComments(code)),
});

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
  it('is 0 when nothing is shared', () => {
    const files = [
      prints('a.ts', block('a', 20)),
      prints('b.ts', block('b', 20)),
    ];

    expect(duplicationByPath(files).get('a.ts')).toBe(0);
    expect(duplicationByPath(files).get('b.ts')).toBe(0);
  });

  it('is 1 for a file copied wholesale', () => {
    const body = block('a', 12);
    const dup = duplicationByPath([prints('a.ts', body), prints('b.ts', body)]);

    expect(dup.get('a.ts')).toBe(1);
    expect(dup.get('b.ts')).toBe(1);
  });

  it('reports the duplicated share of a partly copied file', () => {
    const shared = block('s', CLONE_WINDOW);
    const dup = duplicationByPath([
      prints('a.ts', `${shared}\n${block('a', CLONE_WINDOW)}`),
      prints('b.ts', shared),
    ]);

    // The shared half matches; the file's own half does not.
    expect(dup.get('a.ts')).toBe(0.5);
    expect(dup.get('b.ts')).toBe(1);
  });

  it('counts a block a file repeats within itself', () => {
    const body = block('a', CLONE_WINDOW);
    const dup = duplicationByPath([prints('a.ts', `${body}\n${body}`)]);

    expect(dup.get('a.ts')).toBe(1);
  });

  it('does not call a barrel of re-exports a clone of itself', () => {
    const barrel = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      .map((m) => `export * from './${m}.js';`)
      .join('\n');

    expect(duplicationByPath([prints('index.ts', barrel)]).get('index.ts')).toBe(
      0,
    );
  });

  it('sees through rewritten comments but not through different literals', () => {
    const body = block('a', CLONE_WINDOW);
    const recommented = `// a different comment\n${body}`;
    const relabelled = body.replaceAll('value(', 'other(');
    const dup = duplicationByPath([
      prints('a.ts', body),
      prints('b.ts', recommented),
      prints('c.ts', relabelled),
    ]);

    expect(dup.get('a.ts')).toBe(1);
    expect(dup.get('b.ts')).toBe(1);
    expect(dup.get('c.ts')).toBe(0);
  });

  it('reports 0 for a file with no windows at all', () => {
    const dup = duplicationByPath([prints('tiny.ts', 'export {};')]);

    expect(dup.get('tiny.ts')).toBe(0);
  });
});
