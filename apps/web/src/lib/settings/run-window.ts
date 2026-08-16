import type { Project, ProjectConfig } from '$lib/api';
import { compactNumber } from '$lib/format';

/**
 * What the next run over this project will read: the repository it is mounted
 * at, the revision it resolves, and how far back it reads the history. All
 * three are settings *General* owns — this is the same three said as a
 * sentence, in the place where a run is started, so nobody has to open another
 * screen to see what the button is about to do.
 */
export interface RunWindow {
  /** Absolute working-tree root on the server's machine. */
  root: string;
  rev: string;
  /** The history window, in words — the whole history is not a number. */
  historyLimit: string;
}

export function runWindow(
  project: Pick<Project, 'root'>,
  config: Pick<ProjectConfig, 'rev' | 'historyLimit'>,
): RunWindow {
  return {
    root: project.root,
    rev: config.rev,
    historyLimit: historyText(config.historyLimit),
  };
}

function historyText(limit: number | null): string {
  if (limit === null) return 'Whole history';
  return limit === 1 ? 'Last 1 commit' : `Last ${compactNumber(limit)} commits`;
}
