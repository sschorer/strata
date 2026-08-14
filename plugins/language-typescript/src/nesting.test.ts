import { describe, expect, it } from 'vitest';
import { maxNesting } from './nesting.js';
import { stripNonCode } from './strip.js';

const nestingOf = (source: string): number => maxNesting(stripNonCode(source));

describe('maxNesting', () => {
  it('is 0 without control flow', () => {
    expect(nestingOf('const a = { b: 1 };\nfunction f() { return a; }')).toBe(0);
  });

  it('counts nested control blocks', () => {
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

    expect(nestingOf(source)).toBe(3);
  });

  it('reports the deepest nest, not the last one', () => {
    const source = `
      if (a) {
        if (b) {
          c();
        }
      }
      if (d) {
        e();
      }`;

    expect(nestingOf(source)).toBe(2);
  });

  it('does not count function bodies, classes or object literals', () => {
    const source = `
      class C {
        m() {
          const handlers = { onX: () => { g(); } };
          return handlers;
        }
      }`;

    expect(nestingOf(source)).toBe(0);
  });

  it('counts else, do, try and catch blocks', () => {
    expect(nestingOf('if (a) { b(); } else { c(); }')).toBe(1);
    expect(nestingOf('try { a(); } catch (e) { b(); } finally { c(); }')).toBe(1);
    expect(nestingOf('do { if (a) { b(); } } while (c);')).toBe(2);
  });

  it('does not mistake a call for a control head', () => {
    expect(nestingOf('render(props) { return null; }')).toBe(0);
    expect(nestingOf('describe("if", () => { it("for", () => {}); });')).toBe(0);
  });

  it('counts a block only once for else if', () => {
    expect(nestingOf('if (a) { b(); } else if (c) { d(); }')).toBe(1);
  });
});
