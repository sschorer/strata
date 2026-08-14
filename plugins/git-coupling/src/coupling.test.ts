import { describe, expect, it } from 'vitest';
import { rankCoupling, type CouplingOptions } from './coupling.js';
import { countCoChanges } from './pairs.js';

const opts: CouplingOptions = {
  minChanges: 3,
  minSharedChanges: 2,
  minDegree: 30,
  limit: 500,
};

/** n commits touching every path in `files`. */
const times = (n: number, files: string[]): string[][] =>
  Array.from({ length: n }, () => files);

describe('rankCoupling', () => {
  it('scores an always-together pair at 100%', () => {
    const points = rankCoupling(
      countCoChanges(times(4, ['a.ts', 'a.test.ts']), 30),
      new Set(['a.ts', 'a.test.ts']),
      opts,
    );

    expect(points).toHaveLength(1);
    expect(points[0]!.subject).toBe('a.test.ts ↔ a.ts');
    expect(points[0]!.value).toBe(100);
    expect(points[0]!.meta).toEqual({
      fileA: 'a.test.ts',
      fileB: 'a.ts',
      sharedChanges: 4,
      changesA: 4,
      changesB: 4,
    });
  });

  it('averages both change counts, so a busy file is not coupled to everything', () => {
    // barrel.ts: 8 changes, 4 of them alongside leaf.ts (which has 4).
    const commits = [
      ...times(4, ['barrel.ts', 'leaf.ts']),
      ...times(4, ['barrel.ts']),
    ];
    const [point] = rankCoupling(
      countCoChanges(commits, 30),
      new Set(['barrel.ts', 'leaf.ts']),
      opts,
    );

    // 100 × 4 / ((8 + 4) / 2) = 66.7, not the 100% a min-based degree would give.
    expect(point!.value).toBe(66.7);
  });

  it('drops thin evidence, weak coupling and files gone at this revision', () => {
    const commits = [
      ...times(2, ['thin-a.ts', 'thin-b.ts']), // below minChanges
      ...times(3, ['weak-a.ts', 'weak-b.ts']),
      ...times(8, ['weak-a.ts']),
      ...times(8, ['weak-b.ts']), // 3 shared of avg 11 → 27.3%, below minDegree
      ...times(3, ['kept.ts', 'deleted.ts']),
    ];
    const points = rankCoupling(
      countCoChanges(commits, 30),
      new Set(['thin-a.ts', 'thin-b.ts', 'weak-a.ts', 'weak-b.ts', 'kept.ts']),
      opts,
    );

    expect(points.map((p) => p.subject)).toEqual([]);
  });

  it('ranks by degree, then evidence, then path, and honours the limit', () => {
    const commits = [
      ...times(3, ['a.ts', 'b.ts']),
      ...times(3, ['c.ts', 'd.ts']),
      ...times(1, ['c.ts']),
      ...times(3, ['e.ts', 'f.ts']),
    ];
    const present = new Set(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']);

    const points = rankCoupling(countCoChanges(commits, 30), present, opts);
    expect(points.map((p) => p.subject)).toEqual([
      'a.ts ↔ b.ts', // 100%, tie with e/f broken by path
      'e.ts ↔ f.ts',
      'c.ts ↔ d.ts', // 3 shared of avg 3.5 → 85.7%
    ]);

    expect(
      rankCoupling(countCoChanges(commits, 30), present, { ...opts, limit: 2 }),
    ).toHaveLength(2);
  });
});
