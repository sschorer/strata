import type {
  Project,
  ProjectConfig,
  ProjectConfigPatch,
  UpdateProjectRequest,
} from '$lib/api';

/**
 * The *General* form: what a project is called, and the window an analysis of
 * it reads. Everything here is a string, because that is what a field holds —
 * "the whole history" is an empty box, not a number — and turning the boxes
 * back into a patch is this module's whole job.
 *
 * The root is not among them: it is the mount the server resolved, shown and
 * not edited (`ARCHITECTURE.md` decision 31).
 */
export interface GeneralForm {
  name: string;
  rev: string;
  /** Blank means the whole history. */
  historyLimit: string;
}

/**
 * A save, split the way the server is: identity is the registry entry
 * (`PATCH /projects/:id`), the rest is the project's config one level down.
 * `null` is "this half did not change" — the server refuses a patch that
 * names nothing, and rightly so.
 */
export interface GeneralPatch {
  identity: UpdateProjectRequest | null;
  config: ProjectConfigPatch | null;
}

export type GeneralCheck =
  | { ok: true; patch: GeneralPatch }
  | { ok: false; error: string };

/** The longest display name the registry accepts. */
export const NAME_MAX = 100;

/** What the fields hold when the screen opens, and what a save resets them to. */
export function generalForm(
  project: Pick<Project, 'name'>,
  config: Pick<ProjectConfig, 'rev' | 'historyLimit'>,
): GeneralForm {
  return {
    name: project.name,
    rev: config.rev,
    historyLimit:
      config.historyLimit === null ? '' : String(config.historyLimit),
  };
}

/**
 * Whether the form still says what is stored. Compared trimmed, so trailing
 * whitespace is not an edit — it is not something a save would keep either.
 */
export function generalChanged(form: GeneralForm, saved: GeneralForm): boolean {
  return (
    form.name.trim() !== saved.name.trim() ||
    form.rev.trim() !== saved.rev.trim() ||
    form.historyLimit.trim() !== saved.historyLimit.trim()
  );
}

/**
 * Read the form against what is stored: either the two patches a save sends —
 * holding only the fields that changed — or the first reason it cannot be
 * sent. The rules are the server's own (a name and a revision cannot be blank,
 * a limit is a whole number of commits); checking them here means a typo is
 * answered under the field rather than by a round-trip.
 */
export function checkGeneral(
  form: GeneralForm,
  saved: GeneralForm,
): GeneralCheck {
  const name = form.name.trim();
  if (!name) {
    return { ok: false, error: 'Give the project a display name.' };
  }
  if (name.length > NAME_MAX) {
    return {
      ok: false,
      error: `A display name is at most ${NAME_MAX} characters.`,
    };
  }

  const rev = form.rev.trim();
  if (!rev) {
    return {
      ok: false,
      error:
        'Name the revision to analyse — HEAD follows whatever is checked out.',
    };
  }

  const limit = historyLimit(form.historyLimit);
  if (limit === undefined) {
    return {
      ok: false,
      error:
        'The history limit is a whole number of commits, at least 1 — leave ' +
        'it blank to read the whole history.',
    };
  }

  const config: ProjectConfigPatch = {};
  if (rev !== saved.rev) config.rev = rev;
  if (form.historyLimit.trim() !== saved.historyLimit) {
    config.historyLimit = limit;
  }

  return {
    ok: true,
    patch: {
      identity: name === saved.name ? null : { name },
      config: Object.keys(config).length > 0 ? config : null,
    },
  };
}

/** `null` for the whole history, `undefined` when the text is not a limit. */
function historyLimit(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
}
