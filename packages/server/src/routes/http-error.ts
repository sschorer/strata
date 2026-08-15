/**
 * An error Fastify will serialise with a status of our choosing, in the same
 * `{ statusCode, error, message }` shape its own validation errors use — so a
 * client has one error shape to render, whoever produced it.
 */
export function httpError(
  statusCode: number,
  message: string,
): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}
