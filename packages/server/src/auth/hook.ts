import type { FastifyInstance } from 'fastify';
import { httpError } from '../routes/http-error.js';
import { sameToken } from './compare.js';
import { presentedToken } from './presented.js';

/**
 * The paths that answer without a credential.
 *
 * `/health` alone: it is a liveness probe, called by Docker, compose and every
 * orchestrator without one, and it discloses nothing but whether the process
 * is up. Everything else is behind the token — including the reads, because
 * `GET /plugins` describes what this deployment runs, `GET /projects` and
 * `GET /browse` describe what is on its disk, and `GET /settings` serves
 * provider `env` values as written until secret storage lands.
 *
 * The web UI's own files will belong here too once the server serves them: a
 * browser has to load the app before it can be asked for a token, so the
 * static build is public and every API call under it is not.
 */
const OPEN_PATHS = new Set(['/health']);

/**
 * Require this deployment's bearer token on everything but a liveness probe.
 *
 * Registered as `onRequest`, the first hook in Fastify's lifecycle, so a
 * caller without the token is turned away before a body is parsed, a path is
 * resolved against the roots or a store is opened. It runs for unrouted paths
 * too, so the 401 is also the answer to "which endpoints does this server
 * have?".
 *
 * The allow-list confines what a request may reach; this decides whether the
 * request is answered at all. Both still apply: a caller holding the token is
 * a trusted one, not an unconfined one, so `$STRATA_ROOTS` continues to bound
 * every path they name.
 */
export function requireToken(app: FastifyInstance, token: string): void {
  app.addHook('onRequest', async (req, reply) => {
    if (OPEN_PATHS.has(requestPath(req.url))) return;

    const presented = presentedToken(req);
    if (presented !== undefined && sameToken(presented, token)) return;

    // One answer for a request with no credential and one with the wrong
    // credential: which of the two it was is not the server's to confirm.
    reply.header('WWW-Authenticate', 'Bearer realm="Strata"');
    throw httpError(
      401,
      'This workbench requires a token. Send it as `Authorization: Bearer <token>`.',
    );
  });
}

/** The path a request names, without the query string. */
function requestPath(url: string): string {
  const query = url.indexOf('?');
  return query === -1 ? url : url.slice(0, query);
}
