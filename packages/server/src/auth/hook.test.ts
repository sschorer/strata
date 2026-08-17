import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requireToken } from './hook.js';

/**
 * Who may talk to the API. The allow-list says what a request may reach;
 * this says whether it is answered at all, so the test asserts the guard is in
 * front of *everything* — routes it knows, routes it does not, and the methods
 * that destroy something — with the liveness probe as the one way through.
 */

const TOKEN = 'a-long-enough-test-token';

let app: FastifyInstance;
/** Set by the `/analyze` stand-in, to show what the guard never reaches. */
let handled: boolean;

beforeEach(async () => {
  handled = false;
  app = Fastify();
  requireToken(app, TOKEN);

  // Stand-ins for the real routes: the guard is registered before them, the
  // way `createServer` does it, and knows nothing about what they do.
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/secrets', async () => ({ secrets: 'many' }));
  app.get('/plugins', async () => ({ plugins: [] }));
  app.delete('/cache', async () => ({ cleared: true }));
  app.post('/analyze', async () => {
    handled = true;
    return {};
  });
  // A handler that refuses on its own terms, the way the roots do.
  app.get('/browse', async () => {
    throw Object.assign(new Error('outside the roots'), { statusCode: 403 });
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function call(url: string, headers: Record<string, string> = {}) {
  return app.inject({ url, headers });
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('a request with the token', () => {
  it('is answered', async () => {
    const res = await call('/plugins', bearer(TOKEN));

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ plugins: [] });
  });

  it('may use any capitalisation of the scheme, and extra spacing', async () => {
    const res = await call('/plugins', { authorization: `bearer  ${TOKEN} ` });

    expect(res.statusCode).toBe(200);
  });

  it('may still be refused by the roots — the two limits are separate', async () => {
    const res = await call('/browse', bearer(TOKEN));

    expect(res.statusCode).toBe(403);
  });
});

describe('a request without it', () => {
  it('is refused, whatever it was going to do', async () => {
    for (const url of ['/plugins', '/cache']) {
      expect((await call(url)).statusCode).toBe(401);
    }

    const deleted = await app.inject({ method: 'DELETE', url: '/cache' });
    expect(deleted.statusCode).toBe(401);
  });

  it('names the scheme it should have used', async () => {
    const res = await call('/plugins');

    expect(res.headers['www-authenticate']).toBe('Bearer realm="Strata"');
    expect(res.json().message).toContain('Authorization: Bearer');
  });

  it('is refused before the handler runs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/analyze',
      payload: { root: '/repos/strata' },
    });

    expect(res.statusCode).toBe(401);
    expect(handled).toBe(false);
  });

  it('cannot tell a wrong token from no token, or a real path from an unrouted one', async () => {
    const missing = await call('/plugins');
    const wrong = await call('/plugins', bearer('not-the-token'));
    const unrouted = await call('/nope', bearer('not-the-token'));

    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual(missing.json());
    expect(unrouted.statusCode).toBe(401);
    expect(unrouted.json()).toEqual(missing.json());
  });

  it('is refused for a token that only starts right', async () => {
    expect((await call('/plugins', bearer(TOKEN.slice(0, -1)))).statusCode).toBe(
      401,
    );
    expect((await call('/plugins', bearer(`${TOKEN}x`))).statusCode).toBe(401);
  });

  it('is refused for a credential that is not a bearer one', async () => {
    const basic = await call('/plugins', {
      authorization: `Basic ${Buffer.from(`:${TOKEN}`).toString('base64')}`,
    });
    const bare = await call('/plugins', { authorization: TOKEN });
    const empty = await call('/plugins', { authorization: 'Bearer ' });

    for (const res of [basic, bare, empty]) expect(res.statusCode).toBe(401);
  });

  it('cannot smuggle the token past the header', async () => {
    const query = await call(`/plugins?token=${TOKEN}`);
    const cookie = await call('/plugins', { cookie: `token=${TOKEN}` });

    expect(query.statusCode).toBe(401);
    expect(cookie.statusCode).toBe(401);
  });
});

describe('the liveness probe', () => {
  it('answers without a token, so a container can be watched', async () => {
    const res = await call('/health');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('is exempt by path, not by prefix', async () => {
    expect((await call('/health/secrets')).statusCode).toBe(401);
    expect((await call('/health?verbose=1')).statusCode).toBe(200);
  });
});
