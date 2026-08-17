/**
 * Short enough to be guessed at HTTP speed. Not a policy — nothing is refused
 * for being under it — but a deployment that set a four-character token has
 * almost certainly mistaken it for a placeholder.
 */
const MIN_TOKEN_LENGTH = 16;

/**
 * What to say at startup about the credential this deployment is running with,
 * or `undefined` when there is nothing to say.
 *
 * An open API is a legitimate choice on a workstation and stays the default,
 * so it is a warning rather than a refusal — but it is said out loud on every
 * start, because the failure mode is a port that was only ever meant to be
 * local quietly becoming reachable.
 */
export function authWarning(token: string | undefined): string | undefined {
  if (token === undefined) {
    return (
      'no STRATA_TOKEN set — the API is unauthenticated, so anyone who can ' +
      'reach this port can analyse, register and remove projects, clear the ' +
      'cache and change the settings. Fine on a workstation; set a token ' +
      'before the port is reachable from anywhere else.'
    );
  }
  if (token.length < MIN_TOKEN_LENGTH) {
    return (
      `STRATA_TOKEN is ${token.length} characters — short enough to guess. ` +
      `Use at least ${MIN_TOKEN_LENGTH}, e.g. \`openssl rand -hex 32\`.`
    );
  }
  return undefined;
}
