import type { FastifyRequest } from 'fastify';

/** `Bearer <token>`, case-insensitive in the scheme, as RFC 6750 writes it. */
const BEARER = /^Bearer[ \t]+(\S.*)$/i;

/**
 * The bearer token a request carries, if it carries one.
 *
 * `Authorization` is the only place it is read from. A token in a query string
 * ends up in access logs, browser history and the `Referer` of every link that
 * leaves the page; one in a cookie would be sent by the browser on requests
 * this app never made, which is a CSRF story rather than an auth one.
 */
export function presentedToken(req: FastifyRequest): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return undefined;

  const token = BEARER.exec(header.trim())?.[1]?.trim();
  return token === undefined || token === '' ? undefined : token;
}
