import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '$lib/test/render';
import ServerStatus from './ServerStatus.svelte';

const pluginsResponse = {
  directory: '/repo/.strata/plugins',
  plugins: [
    {
      id: 'strata-commit-conventional',
      name: 'Conventional Commits',
      kind: 'commit-convention',
      version: '0.1.0',
      sdk: '0.1.0',
      main: './dist/index.js',
      source: 'builtin',
    },
  ],
  failures: [],
};

/** Answer each API path the component asks for. */
function stubApi(responses: Record<string, () => Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const respond = responses[url];
      if (!respond) throw new Error(`unexpected request: ${url}`);
      return respond();
    }),
  );
}

let ui: ReturnType<typeof render>;

afterEach(() => {
  ui?.destroy();
  vi.unstubAllGlobals();
});

describe('ServerStatus', () => {
  it('reports health and the loaded plugins', async () => {
    stubApi({
      '/health': () => Response.json({ status: 'ok' }),
      '/plugins': () => Response.json(pluginsResponse),
    });

    ui = render(ServerStatus);

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('Conventional Commits');
    });
    expect(ui.container.textContent).toContain('/repo/.strata/plugins');
    expect(ui.container.textContent).toContain('commit-convention · builtin');
  });

  it('says the server is unreachable instead of showing a blank card', async () => {
    stubApi({
      '/health': () => {
        throw new TypeError('Failed to fetch');
      },
      '/plugins': () => Response.json(pluginsResponse),
    });

    ui = render(ServerStatus);

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('Cannot reach');
    });
    expect(ui.container.textContent).toContain('make dev');
  });

  it('surfaces the message from a failing endpoint', async () => {
    stubApi({
      '/health': () => Response.json({ status: 'ok' }),
      '/plugins': () =>
        Response.json({ message: 'plugins directory unreadable' }, { status: 500 }),
    });

    ui = render(ServerStatus);

    await vi.waitFor(() => {
      expect(ui.container.textContent).toContain('plugins directory unreadable');
    });
  });
});
