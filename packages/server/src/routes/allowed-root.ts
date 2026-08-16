import {
  allowedDirectory,
  NoSuchDirectoryError,
  RootDeniedError,
} from '@strata/core';
import { httpError } from './http-error.js';

/**
 * The directory a request named, resolved and confined to the roots this
 * deployment allows (`$STRATA_ROOTS`) — or a 403.
 *
 * Every endpoint that takes a path from a caller goes through here, because
 * the API is unauthenticated: without it, `root` is "any directory this process
 * can read" and the workbench walks whatever it is pointed at. The resolved
 * path is what the caller should use from then on, so what runs is what was
 * checked.
 */
export async function requireAllowedRoot(path: string): Promise<string> {
  try {
    return await allowedDirectory(path);
  } catch (err) {
    throw rootError(err);
  }
}

/**
 * The two refusals of the roots policy as HTTP: outside the allow-list (or
 * unreadable) is a 403, a path that is simply not a directory is a 404.
 */
export function rootError(err: unknown): unknown {
  if (err instanceof RootDeniedError) return httpError(403, err.message);
  if (err instanceof NoSuchDirectoryError) return httpError(404, err.message);
  return err;
}
