import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import { session } from './session.svelte';
import Unlock from './Unlock.svelte';

/**
 * The way in when the server was started with a token. It checks the token
 * before adopting it, so a typo is answered here rather than by every screen
 * behind it failing again.
 */

let ui: ReturnType<typeof render>;
let unlocked: number;

function field(): HTMLInputElement {
  const input = ui.container.querySelector('input');
  if (!input) throw new Error('no token field');
  return input;
}

function submit(token: string): void {
  const input = field();
  input.value = token;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
  ui.container.querySelector('form')?.requestSubmit();
}

/** The submit handler awaits the server; let the round-trip finish. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
}

function text(): string {
  return ui.container.textContent ?? '';
}

beforeEach(() => {
  localStorage.clear();
  session.forget();
  unlocked = 0;
  ui = render(Unlock, { onunlocked: () => (unlocked += 1) });
});

afterEach(() => {
  ui.destroy();
  vi.unstubAllGlobals();
  session.forget();
});

describe('Unlock', () => {
  it('says what the workbench wants', () => {
    expect(text()).toContain('STRATA_TOKEN');
    expect(field().type).toBe('password');
  });

  it('adopts a token the server answers to', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ plugins: [] })),
    );

    submit('the-real-token');
    await settle();

    expect(session.token).toBe('the-real-token');
    expect(session.locked).toBe(false);
    expect(unlocked).toBe(1);
  });

  it('checks the token before storing it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ message: 'needs a token' }, { status: 401 }),
      ),
    );

    submit('a-guess');
    await settle();

    expect(text()).toContain('not accepted');
    expect(session.token).toBeNull();
    expect(unlocked).toBe(0);
  });

  it('reports a server that is down as itself, not as a bad token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    submit('the-real-token');
    await settle();

    expect(text()).toContain('Cannot reach');
    expect(unlocked).toBe(0);
  });

  it('asks for a token rather than sending an empty one', async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);

    submit('   ');
    await settle();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(text()).toContain('Enter the token');
  });

  it('explains itself differently once a token has been turned down', () => {
    session.unlock('stale');
    session.challenge();
    flushSync();

    expect(text()).toContain('refused');
  });
});
