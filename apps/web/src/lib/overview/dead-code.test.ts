import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { deadCodeCount } from './dead-code';

const report = (
  deadCode: Record<string, { path: string; reason: string }[]>,
): AnalysisReport =>
  ({
    languages: Object.fromEntries(
      Object.entries(deadCode).map(([name, findings]) => [
        name,
        { graph: { nodes: [], edges: [], cycles: [] }, deadCode: findings },
      ]),
    ),
  }) as unknown as AnalysisReport;

describe('deadCodeCount', () => {
  it('counts every language', () => {
    expect(
      deadCodeCount(
        report({
          typescript: [
            { path: 'src/a.ts', reason: 'unreferenced-export' },
            { path: 'src/b.ts', reason: 'unreachable-file' },
          ],
          python: [{ path: 'lib/c.py', reason: 'unreferenced-export' }],
        }),
      ),
    ).toEqual({ findings: 3, files: 3 });
  });

  it('counts a file once however many symbols it is holding', () => {
    expect(
      deadCodeCount(
        report({
          typescript: [
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
            { path: 'src/barrel.ts', reason: 'unreferenced-export' },
          ],
        }),
      ),
    ).toEqual({ findings: 3, files: 1 });
  });

  it('is zero for a report with no language results', () => {
    expect(deadCodeCount(report({}))).toEqual({ findings: 0, files: 0 });
  });
});
