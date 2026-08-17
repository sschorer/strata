/**
 * Who may talk to the API. One shared secret (`$STRATA_TOKEN`), presented as a
 * bearer token, checked before anything else in the request lifecycle.
 *
 * This file is a barrel: one concern per module.
 */
export { configuredToken } from './token.js';
export { requireToken } from './hook.js';
export { authWarning } from './warning.js';
export { presentedToken } from './presented.js';
export { sameToken } from './compare.js';
