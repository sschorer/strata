import type { Logger } from '@strata/sdk';

/** A console logger tagged with a scope, e.g. `[strata] …`, `[strata:cache] …`. */
export function createConsoleLogger(scope = 'strata'): Logger {
  const tag = `[${scope}]`;
  return {
    debug: (m, meta) => console.debug(`${tag} ${m}`, meta ?? ''),
    info: (m, meta) => console.info(`${tag} ${m}`, meta ?? ''),
    warn: (m, meta) => console.warn(`${tag} ${m}`, meta ?? ''),
    error: (m, meta) => console.error(`${tag} ${m}`, meta ?? ''),
  };
}

/** The default logger handed to plugins through `RepoContext.log`. */
export const consoleLogger: Logger = createConsoleLogger();
