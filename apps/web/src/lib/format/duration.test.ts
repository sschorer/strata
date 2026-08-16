import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('keeps sub-second runs in milliseconds', () => {
    expect(formatDuration(0)).toBe('0 ms');
    expect(formatDuration(842.4)).toBe('842 ms');
  });

  it('prints seconds with one decimal', () => {
    expect(formatDuration(1000)).toBe('1.0 s');
    expect(formatDuration(2440)).toBe('2.4 s');
  });

  it('splits a long run into minutes and seconds', () => {
    expect(formatDuration(64_000)).toBe('1 m 4 s');
    expect(formatDuration(120_000)).toBe('2 m');
    // Rounding the remainder on its own would say "1 m 60 s" here.
    expect(formatDuration(119_600)).toBe('2 m');
  });

  it('has nothing to say about a nonsense duration', () => {
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });
});
