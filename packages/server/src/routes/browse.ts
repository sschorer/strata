import type { FastifyInstance } from 'fastify';
import { listDirectory } from '@strata/core';
import { rootError } from './allowed-root.js';

interface BrowseQuery {
  path?: string;
  hidden?: boolean;
}

const schema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: { type: 'string', minLength: 1 },
      // Query strings are text: the schema coerces, so `?hidden=true` is a
      // boolean here rather than a truthy string.
      hidden: { type: 'boolean' },
    },
  },
};

/**
 * The folder picker behind *Add project*: the subdirectories of one directory
 * on the machine running the server, and which of them are repositories.
 *
 * Names of directories, nothing else — no files, no contents — and only inside
 * `$STRATA_ROOTS` (the server user's home by default). That confinement is the
 * point: this endpoint is otherwise a directory enumerator for whoever can
 * reach the API, and on a deployment that set no `$STRATA_TOKEN` that is
 * anyone who can reach the port.
 */
export function browseRoute(app: FastifyInstance): void {
  app.get<{ Querystring: BrowseQuery }>(
    '/browse',
    { schema },
    async (req) => {
      try {
        return await listDirectory({
          path: req.query.path,
          hidden: req.query.hidden,
        });
      } catch (err) {
        throw rootError(err);
      }
    },
  );
}
