import { describe, expect, it } from 'vitest';
import plugin from './index.js';

const base = {
  sha: 'abc123',
  author: 'Ada',
  authorEmail: 'ada@example.com',
  date: '2026-01-01T00:00:00Z',
};

describe('conventional-commits plugin', () => {
  it('parses type, scope and subject', () => {
    const r = plugin.parse({ ...base, message: 'feat(core): add registry' });
    expect(r.valid).toBe(true);
    expect(r.type).toBe('feat');
    expect(r.scope).toBe('core');
    expect(r.subject).toBe('add registry');
    expect(r.breaking).toBe(false);
  });

  it('detects breaking changes via ! and footer', () => {
    expect(plugin.parse({ ...base, message: 'feat!: drop node 18' }).breaking).toBe(true);
    expect(
      plugin.parse({
        ...base,
        message: 'refactor: x\n\nBREAKING CHANGE: api moved',
      }).breaking,
    ).toBe(true);
  });

  it('extracts issue refs and marks non-conventional messages invalid', () => {
    const r = plugin.parse({ ...base, message: 'fix: patch leak (#42)\n\ncloses #7' });
    expect(r.tags.issues).toEqual(['42', '7']);

    const bad = plugin.parse({ ...base, message: 'just some words' });
    expect(bad.valid).toBe(false);
    expect(bad.type).toBeNull();
  });
});
