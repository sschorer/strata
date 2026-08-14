import { describe, expect, it } from 'vitest';
import { parseExports } from './exports.js';

describe('parseExports', () => {
  it('names every declaration form, with its line', () => {
    const { exports } = parseExports(
      [
        'export const a = 1;',
        'export let b = 2;',
        'export function c() {}',
        'export async function* d() {}',
        'export class E {}',
        'export abstract class F {}',
        'export interface G {}',
        'export type H = string;',
        'export enum I {}',
        'export const enum J {}',
        'export declare const k: number;',
      ].join('\n'),
    );

    expect(exports).toEqual([
      { name: 'a', line: 1 },
      { name: 'b', line: 2 },
      { name: 'c', line: 3 },
      { name: 'd', line: 4 },
      { name: 'E', line: 5 },
      { name: 'F', line: 6 },
      { name: 'G', line: 7 },
      { name: 'H', line: 8 },
      { name: 'I', line: 9 },
      { name: 'J', line: 10 },
      { name: 'k', line: 11 },
    ]);
  });

  it('records a default export under the name importers use', () => {
    const named = parseExports('export default function helper() {}');
    const expression = parseExports('export default { a: 1 };');

    expect(named.exports).toEqual([{ name: 'default', line: 1 }]);
    expect(expression.exports).toEqual([{ name: 'default', line: 1 }]);
  });

  it('exports the alias and uses the source name of a clause', () => {
    const { exports, uses } = parseExports(
      ['export {', '  local,', '  hidden as shown,', '};'].join('\n'),
    );

    expect(exports).toEqual([
      { name: 'local', line: 2 },
      { name: 'shown', line: 3 },
    ]);
    expect(uses).toEqual([]);
  });

  it('treats a re-export as both an export and an import', () => {
    const { exports, uses, stars } = parseExports(
      [
        `export { a, b as c } from './x.js';`,
        `export * as ns from './y.js';`,
        `export * from './z.js';`,
        `export type { T } from './t.js';`,
      ].join('\n'),
    );

    expect(exports).toEqual([
      { name: 'a', line: 1 },
      { name: 'c', line: 1 },
      { name: 'ns', line: 2 },
      { name: 'T', line: 4 },
    ]);
    expect(uses).toEqual([
      { spec: './x.js', names: ['a', 'b'], namespace: false },
      { spec: './y.js', names: [], namespace: true },
      { spec: './t.js', names: ['T'], namespace: false },
    ]);
    // A star names nothing: what it keeps alive depends on the barrel's callers.
    expect(stars).toEqual(['./z.js']);
  });
});
