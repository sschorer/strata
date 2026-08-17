import { afterEach, describe, expect, it, vi } from 'vitest';
import { Session } from './session.svelte';
import { TOKEN_STORAGE_KEY } from './storage';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Session', () => {
  it('starts from what this browser stored', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'from-storage');

    const session = new Session();

    expect(session.token).toBe('from-storage');
    expect(session.locked).toBe(false);
  });

  it('holds nothing on a workbench that never asked', () => {
    const session = new Session();

    expect(session.token).toBeNull();
    expect(session.locked).toBe(false);
  });

  it('locks when the server challenges, and says a token was never held', () => {
    const session = new Session(null);

    session.challenge();

    expect(session.locked).toBe(true);
    expect(session.refused).toBe(false);
  });

  it('drops a refused token rather than sending it again after a reload', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'stale');
    const session = new Session();

    session.challenge();

    expect(session.refused).toBe(true);
    expect(session.token).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('unlocks with a token and remembers it', () => {
    const session = new Session(null);
    session.challenge();

    session.unlock('the-real-token');

    expect(session.token).toBe('the-real-token');
    expect(session.locked).toBe(false);
    expect(session.refused).toBe(false);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('the-real-token');
  });

  it('forgets a token without a challenge', () => {
    const session = new Session('held');

    session.forget();

    expect(session.token).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('works where storage does not', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const session = new Session(null);

    expect(() => session.unlock('the-real-token')).not.toThrow();
    expect(session.token).toBe('the-real-token');
  });
});
