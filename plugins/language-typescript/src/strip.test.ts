import { describe, expect, it } from 'vitest';
import { stripComments, stripNonCode } from './strip.js';

/**
 * What survived the strip, with the blanked runs collapsed — asserting on the
 * exact number of spaces would test the length of the fixtures, not the lexer.
 * The alignment those spaces preserve gets its own test below.
 */
const kept = (source: string): string =>
  stripNonCode(source).replace(/ +/g, ' ').trim();

describe('stripNonCode', () => {
  it('keeps the output aligned with the input, character for character', () => {
    const source = 'const a = 1; // if (x) {\n/* if (y) */ b();\n';
    const code = stripNonCode(source);

    expect(code).toHaveLength(source.length);
    expect(code.split('\n')).toEqual(['const a = 1;            ', '             b();', '']);
  });

  it('blanks comments', () => {
    expect(kept('a(); // if (x) { y }')).toBe('a();');
    expect(kept('/* if (x) */ a(); /* while (y)')).toBe('a();');
  });

  it('blanks strings, quotes and all', () => {
    expect(kept(`const s = 'if (a) { b }';`)).toBe('const s = ;');
    expect(kept('const s = "a\\"b" + c;')).toBe('const s = + c;');
  });

  it('does not let an unterminated quote swallow the rest of the file', () => {
    const code = stripNonCode("const s = 'oops;\nif (a) b();\n");

    expect(code.split('\n')[1]).toBe('if (a) b();');
  });

  it('keeps template interpolations and drops the literal around them', () => {
    expect(kept('const s = `x ${a ? b : c} y`;')).toBe('const s = a ? b : c ;');
  });

  it('handles a template nested inside an interpolation', () => {
    expect(kept('f(`a ${g(`b ${c && d}`)} e`);')).toBe('f( g( c && d ) );');
  });

  it('treats a brace inside an interpolation as code, not as the closer', () => {
    const code = kept('`${ ((): void => { if (a) b(); })() }` + c;');

    expect(code).toBe('((): void => { if (a) b(); })() + c;');
  });

  it('blanks a regex literal, quotes and slashes and all', () => {
    expect(kept(`const re = /['"]\\/\\/[^/]*/g;\nif (a) b();`)).toBe(
      'const re = ;\nif (a) b();',
    );
  });

  it('reads a slash after a value as division, not as a regex', () => {
    expect(kept('const r = total / count / 2;')).toBe('const r = total / count / 2;');
  });

  it('reads a slash after a keyword or an operator as a regex', () => {
    expect(kept('return /a b/.test(s);')).toBe('return .test(s);');
    expect(kept('const m = s.split(/,/);')).toBe('const m = s.split( );');
  });
});

describe('stripComments', () => {
  it('drops the comments and keeps every literal', () => {
    const source = [
      '/** doc */',
      `export * from './version.js'; // barrel`,
      'const s = `x ${a ? b : c} y`;',
      "const re = /a'b/g;",
    ].join('\n');

    expect(stripComments(source).split('\n')).toEqual([
      '          ',
      `export * from './version.js';          `,
      'const s = `x ${a ? b : c} y`;',
      "const re = /a'b/g;",
    ]);
  });

  it('does not mistake a comment marker inside a literal for a comment', () => {
    const source = `const url = 'https://example.com'; // gone\nnext();`;

    expect(stripComments(source).split('\n')[0]).toBe(
      `const url = 'https://example.com';        `,
    );
  });
});
