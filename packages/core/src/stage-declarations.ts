import { OUTPUT_TYPES } from '@strata/sdk';

/**
 * Why a manifest's stage declarations are not usable, or `null` when they are.
 *
 * Checked from the JSON alone, before the entry module is imported: the core
 * plans a run — orders the stages, resolves what each one consumes, rejects a
 * configuration nothing can satisfy — without running third-party code
 * (`docs/adr/0010`). A declaration it cannot honour therefore has to fail as a
 * validation error at the same moment `kind` does, not halfway through a load.
 *
 * Takes the parsed JSON rather than a `PluginManifest`, because a hand-written
 * manifest has not earned that type yet: every field here may be any JSON at
 * all, and saying so is the point of the checks.
 */
export function stageDeclarationError(
  fields: Record<string, unknown>,
): string | null {
  const { consumes, produces, filter, exclusive } = fields;

  if (consumes !== undefined) {
    if (!Array.isArray(consumes)) {
      return 'has a "consumes" that is not an array of output types';
    }
    for (const type of consumes) {
      const unknown = unknownOutputType(type, 'consumes');
      if (unknown) return unknown;
    }
  }

  if (produces !== undefined) {
    const unknown = unknownOutputType(produces, 'produces');
    if (unknown) return unknown;
  }

  if (filter !== undefined) {
    const error = filterError(filter);
    if (error) return error;
  }

  if (
    exclusive !== undefined &&
    (typeof exclusive !== 'string' || exclusive.trim() === '')
  ) {
    return 'has an "exclusive" that is not a group name';
  }

  return null;
}

/**
 * The set of output types is closed (`docs/adr/0010`), so a name that is not
 * one is a plugin written against a Strata that has it, or a typo — either way
 * a stage the core could never wire up. The message lists the set, which is
 * short and is the answer.
 */
function unknownOutputType(value: unknown, field: string): string | null {
  if (
    typeof value === 'string' &&
    (OUTPUT_TYPES as readonly string[]).includes(value)
  ) {
    return null;
  }
  return (
    `declares unknown output type ${JSON.stringify(value)} in "${field}" ` +
    `(expected one of ${OUTPUT_TYPES.join(', ')})`
  );
}

/**
 * A filter the core cannot apply is worse than none: it would hand the stage
 * nothing and skip it every run, which reads on screen as a stage that found
 * nothing. So an empty filter is refused rather than honoured.
 */
function filterError(filter: unknown): string | null {
  if (typeof filter !== 'object' || filter === null || Array.isArray(filter)) {
    return 'has a "filter" that is not an object';
  }

  const { extensions, globs } = filter as Record<string, unknown>;
  for (const [field, value] of [
    ['extensions', extensions],
    ['globs', globs],
  ] as const) {
    if (value === undefined) continue;
    if (!Array.isArray(value) || value.some((entry) => !isName(entry))) {
      return `has a "filter.${field}" that is not a list of ${field}`;
    }
  }

  const named = [...asStrings(extensions), ...asStrings(globs)];
  if (named.length === 0) {
    return 'has a "filter" naming neither extensions nor globs';
  }

  // The language contract has always spelled extensions bare, and the core
  // matches them that way; ".ts" would quietly match nothing.
  const dotted = asStrings(extensions).find((entry) => entry.startsWith('.'));
  if (dotted !== undefined) {
    return `declares the filter extension "${dotted}" with a leading dot (write it as "${dotted.slice(1)}")`;
  }

  return null;
}

function isName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isName) : [];
}
