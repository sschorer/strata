import { describe, expect, it } from 'vitest';
import { relativeAge } from './age';

const now = Date.parse('2026-08-15T12:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

describe('relativeAge', () => {
  it('calls anything inside the last minute recent', () => {
    expect(relativeAge(ago(0), now)).toBe('just now');
    expect(relativeAge(ago(59_000), now)).toBe('just now');
  });

  it('steps up through minutes, hours, days and weeks', () => {
    expect(relativeAge(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(relativeAge(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(relativeAge(ago(2 * 86_400_000), now)).toBe('2 d ago');
    expect(relativeAge(ago(3 * 7 * 86_400_000), now)).toBe('3 w ago');
  });

  it('never prints a future for a clock that runs behind', () => {
    expect(relativeAge(new Date(now + 20_000).toISOString(), now)).toBe(
      'just now',
    );
  });

  it('has nothing to say about an unparseable timestamp', () => {
    expect(relativeAge('not a date', now)).toBe('—');
  });
});
