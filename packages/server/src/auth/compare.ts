import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Whether a presented credential is the configured one.
 *
 * Compared in constant time: `===` on a secret returns sooner the earlier the
 * two differ, and over enough tries that timing is the secret itself, one
 * character at a time.
 *
 * Both sides are hashed first, so the comparison is over two fixed-width
 * digests. `timingSafeEqual` refuses buffers of different lengths, and handing
 * it the raw strings would either throw on every wrong-length guess or leak
 * how long the real token is.
 */
export function sameToken(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
