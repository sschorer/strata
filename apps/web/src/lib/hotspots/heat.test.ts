import { describe, expect, it } from 'vitest';
import { heatBands, heatColor, heatInk, heatLevel, heatScale } from './heat';

describe('heatScale', () => {
  it('spreads a skewed set across all five levels', () => {
    // One file dwarfs the rest: equal-value steps would paint nine of ten cold.
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 5000];
    const scale = heatScale(values);

    const levels = values.map((value) => heatLevel(scale, value));
    expect(new Set(levels)).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(heatLevel(scale, 5000)).toBe(5);
    expect(heatLevel(scale, 1)).toBe(1);
  });

  it('keeps the observed range for the legend', () => {
    const scale = heatScale([4, 1, 9]);
    expect(scale.min).toBe(1);
    expect(scale.max).toBe(9);
  });

  it('survives an empty set', () => {
    const scale = heatScale([]);
    expect(scale).toEqual({ min: 0, max: 0, breaks: [0, 0, 0, 0] });
    expect(heatLevel(scale, 0)).toBe(1);
    expect(heatLevel(scale, 12)).toBe(5);
  });

  it('puts every value on one level when they are all equal', () => {
    const scale = heatScale([7, 7, 7]);
    expect(heatLevel(scale, 7)).toBe(1);
  });
});

describe('heatBands', () => {
  it('chains the ranges from min to max', () => {
    const bands = heatBands(heatScale([0, 10, 20, 30, 40, 50]));

    expect(bands).toHaveLength(5);
    expect(bands[0]!.from).toBe(0);
    expect(bands[4]!.to).toBe(50);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]!.from).toBe(bands[i - 1]!.to);
    }
  });
});

describe('heat tokens', () => {
  it('names the palette variable for a level', () => {
    expect(heatColor(3)).toBe('var(--strata-h3)');
    expect(heatInk(3)).toBe('var(--strata-h3-ink)');
  });
});
