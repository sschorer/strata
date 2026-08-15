import { httpError } from './http-error.js';

/**
 * Refuse a PATCH that changes nothing.
 *
 * This is a runtime check rather than a `minProperties` schema keyword because
 * Fastify strips fields the schema does not declare *after* validating: a body
 * of nothing but misspelled keys passes `minProperties` and then arrives here
 * empty, which would otherwise read as a successful update of nothing.
 */
export function requirePatch<T extends object>(body: T, what: string): T {
  if (Object.keys(body).length === 0) {
    throw httpError(400, `Name at least one ${what} to change.`);
  }
  return body;
}
