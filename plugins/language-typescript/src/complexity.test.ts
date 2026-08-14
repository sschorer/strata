import { describe, expect, it } from 'vitest';
import { cyclomaticComplexity } from './complexity.js';
import { withSyntaxTree } from './parser.js';

const complexityOf = (source: string): Promise<number> =>
  withSyntaxTree('a.ts', source, cyclomaticComplexity);

describe('cyclomaticComplexity', () => {
  it('is 1 for straight-line code', async () => {
    expect(await complexityOf('const a = 1;\nfoo(a);\n')).toBe(1);
  });

  it('counts every branch, loop, case and catch', async () => {
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
    expect(await complexityOf(source)).toBe(8);
  });

  it('counts a do…while once', async () => {
    expect(await complexityOf('do { a(); } while (b());')).toBe(2);
  });

  it('counts logical operators and ternaries', async () => {
    expect(await complexityOf('const a = b && c || d ?? e;')).toBe(4);
    expect(await complexityOf('const a = b ? c : d;')).toBe(2);
    expect(await complexityOf('a ||= b;')).toBe(2);
  });

  it('does not count optional chaining or optional parameters', async () => {
    expect(
      await complexityOf('function f(a?: string, b?) { return a?.length; }'),
    ).toBe(1);
    expect(await complexityOf('interface I { a?: string; b?: number }')).toBe(1);
  });

  it('does not count a conditional type', async () => {
    // It branches the type checker, not the program.
    expect(
      await complexityOf('type Widen<T> = T extends string ? string : T;'),
    ).toBe(1);
  });

  it('ignores keywords in comments, strings and identifiers', async () => {
    const source = `
      // if (a) for (b) while (c)
      const clarify = 'case && ||';
      const notified = 1;
      notify(clarify, notified);`;

    expect(await complexityOf(source)).toBe(1);
  });
});
