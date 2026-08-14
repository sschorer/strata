import { describe, expect, it } from 'vitest';
import { cyclomaticComplexity } from './complexity.js';
import { stripNonCode } from './strip.js';

const complexityOf = (source: string): number =>
  cyclomaticComplexity(stripNonCode(source));

describe('cyclomaticComplexity', () => {
  it('is 1 for straight-line code', () => {
    expect(complexityOf('const a = 1;\nfoo(a);\n')).toBe(1);
  });

  it('counts every branch, loop, case and catch', () => {
    const source = `
      function f(xs) {
        for (const x of xs) {
          if (x) return 1;
          else if (!x) return 2;
          switch (x) {
            case 1: break;
            case 2: break;
            default: break;
          }
        }
        while (g()) h();
        try { i(); } catch { j(); }
      }`;

    // 1 + for + if + if + case + case + while + catch
    expect(complexityOf(source)).toBe(8);
  });

  it('counts a do…while once', () => {
    expect(complexityOf('do { a(); } while (b());')).toBe(2);
  });

  it('counts logical operators and ternaries', () => {
    expect(complexityOf('const a = b && c || d ?? e;')).toBe(4);
    expect(complexityOf('const a = b ? c : d;')).toBe(2);
  });

  it('does not count optional chaining or optional parameters', () => {
    expect(complexityOf('function f(a?: string, b?) { return a?.length; }')).toBe(1);
    expect(complexityOf('interface I { a?: string; b?: number }')).toBe(1);
  });

  it('ignores keywords in comments, strings and identifiers', () => {
    const source = `
      // if (a) for (b) while (c)
      const clarify = 'case && ||';
      const notified = 1;
      notify(clarify, notified);`;

    expect(complexityOf(source)).toBe(1);
  });
});
