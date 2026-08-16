import type { ProjectAnalysis } from '$lib/api';

/**
 * Where the recent runs are kept: one entry per project, in this browser.
 *
 * The server records only the *last* run against a registered project, so a
 * list of several has nowhere else to live yet. Keeping it here means the log
 * survives a reload and is honest about being local — it is what this browser
 * ran, and a run started from another machine shows up as the registry's last
 * one when the screen opens.
 */
export const RECENTS_STORAGE_KEY = 'strata:recents';

/** Empty when nothing is stored, unreadable, or storage is unavailable. */
export function readRecents(projectId: string): readonly ProjectAnalysis[] {
  const stored = readAll()[projectId];
  return Array.isArray(stored) ? stored.filter(isRun) : [];
}

/** Replace one project's log. An empty list drops the entry entirely. */
export function storeRecents(
  projectId: string,
  runs: readonly ProjectAnalysis[],
): void {
  const all = readAll();
  if (runs.length > 0) all[projectId] = [...runs];
  else delete all[projectId];

  try {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private mode, storage disabled or full: the log stays in memory for as
    // long as the screen is open, which is more than nothing and costs the
    // reader no error.
  }
}

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    // Anything but an object — an older format, or something else writing this
    // key — is treated as nothing stored rather than crashing the screen.
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only entries in the registry's own shape are shown; the rest are dropped. */
function isRun(value: unknown): value is ProjectAnalysis {
  if (!isRecord(value)) return false;
  return (
    typeof value.rev === 'string' &&
    (typeof value.branch === 'string' || value.branch === null) &&
    typeof value.files === 'number' &&
    typeof value.durationMs === 'number' &&
    typeof value.finishedAt === 'string'
  );
}
