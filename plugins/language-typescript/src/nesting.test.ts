import { describe, expect, it } from 'vitest';
import { maxNesting } from './nesting.js';
import { withSyntaxTree } from './parser.js';

const nestingOf = (source: string): Promise<number> =>
  withSyntaxTree('a.ts', source, maxNesting);

describe('maxNesting', () => {
  it('is 0 without control flow', async () => {
    expect(
      await nestingOf('const a = { b: 1 };\nfunction f() { return a; }'),
    ).toBe(0);
  });

  it('counts nested control blocks', async () => {
    const source = `
      function f(xs) {
        for (const x of xs) {
          if (x) {
            while (x.next) {
              x = x.next;
            }
          }
        }
      }`;

    expect(await nestingOf(source)).toBe(3);
  });

  it('reports the deepest nest, not the last one', async () => {
    const source = `
      if (a) {
        if (b) {
          c();
        }
      }
      if (d) {
        e();
      }`;

    expect(await nestingOf(source)).toBe(2);
  });

  it('does not count function bodies, classes or object literals', async () => {
    const source = `
      class C {
        m() {
          const handlers = { onX: () => { g(); } };
          return handlers;
        }
      }`;

    expect(await nestingOf(source)).toBe(0);
  });

  it('counts else, do, try and catch blocks', async () => {
    expect(await nestingOf('if (a) { b(); } else { c(); }')).toBe(1);
    expect(
      await nestingOf('try { a(); } catch (e) { b(); } finally { c(); }'),
    ).toBe(1);
    expect(await nestingOf('do { if (a) { b(); } } while (c);')).toBe(2);
  });

  it('does not mistake a call for a control head', async () => {
    expect(await nestingOf('describe("if", () => { it("for", () => {}); });')).toBe(
      0,
    );
  });

  it('counts a block only once for else if', async () => {
    expect(await nestingOf('if (a) { b(); } else if (c) { d(); }')).toBe(1);
    expect(
      await nestingOf('if (a) { b(); } else if (c) { if (d) { e(); } }'),
    ).toBe(2);
  });

  it('counts a branch that skipped its braces', async () => {
    // Braces are formatting; the nest is the same either way.
    expect(await nestingOf('for (const x of xs) if (x) return x;')).toBe(2);
  });
});
