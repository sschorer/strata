/**
 * The shared secret this deployment requires, or `undefined` for an API that
 * answers anyone who can reach the port.
 *
 * `$STRATA_TOKEN` is the whole of the credential, the way `$STRATA_ROOTS` is
 * the whole of the path allow-list: one secret for one workbench, set where
 * the rest of the deployment is described. Surrounding whitespace is stripped,
 * because a token pasted into an `.env` file or a compose environment usually
 * arrives with some.
 *
 * A variable set to nothing reads as unset. The alternative — an empty string
 * as a valid token — would leave the API open while looking configured, which
 * is the one failure this feature exists to prevent.
 */
export function configuredToken(
  configured: string | undefined = process.env.STRATA_TOKEN,
): string | undefined {
  const token = (configured ?? '').trim();
  return token === '' ? undefined : token;
}
