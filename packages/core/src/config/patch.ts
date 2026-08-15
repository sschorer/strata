import { InvalidConfigError } from './errors.js';
import type {
  ArchitectureRule,
  ProjectConfig,
  ProjectConfigPatch,
} from './types.js';

/**
 * Merge a patch into a stored config and hand back the new stored value —
 * still sparse, so untouched fields keep following the defaults.
 *
 * Everything is normalised on the way in (trimmed, blanks dropped, duplicates
 * collapsed) and refused when it cannot mean anything: a settings screen that
 * posts an empty glob row should not turn into a rule nobody can read back.
 */
export function applyPatch(
  stored: Partial<ProjectConfig>,
  patch: ProjectConfigPatch,
): Partial<ProjectConfig> {
  const next: Partial<ProjectConfig> = { ...stored };

  if (patch.rev !== undefined) next.rev = required(patch.rev, 'revision');
  if (patch.historyLimit !== undefined) {
    next.historyLimit = historyLimit(patch.historyLimit);
  }
  if (patch.ignore !== undefined) next.ignore = list(patch.ignore);
  if (patch.paths !== undefined) next.paths = list(patch.paths);
  if (patch.languages !== undefined) {
    next.languages = ids(patch.languages, 'language plugin');
  }
  if (patch.metrics !== undefined) {
    next.metrics = ids(patch.metrics, 'git metric plugin');
  }
  if (patch.convention !== undefined) {
    next.convention = patch.convention === null
      ? null
      : required(patch.convention, 'commit convention');
  }
  if (patch.rules !== undefined) next.rules = patch.rules.map(rule);

  return next;
}

function required(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new InvalidConfigError(`The ${field} cannot be blank.`);
  return trimmed;
}

function historyLimit(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 1) {
    throw new InvalidConfigError(
      'The history limit must be a whole number of commits, at least 1 — ' +
        'use null for the whole history.',
    );
  }
  return value;
}

/** Blank entries are what an empty row in an editable chip list looks like. */
function list(values: string[]): string[] {
  return unique(values.map((v) => v.trim()).filter(Boolean));
}

function ids(values: string[] | null, field: string): string[] | null {
  if (values === null) return null;
  return unique(values.map((v) => required(v, field)));
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function rule(value: ArchitectureRule): ArchitectureRule {
  return {
    from: required(value.from, 'rule source'),
    to: required(value.to, 'rule target'),
    enforced: value.enforced ?? false,
  };
}
