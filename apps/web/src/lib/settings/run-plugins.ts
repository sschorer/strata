import type { LoadedPluginInfo } from '$lib/api';

/**
 * One plugin, as *Analyze / run* shows it: whether the next run calls it at
 * all, and — when it does not — why it stands by. A chip that only listed what
 * is installed would answer a question nobody asked in front of a *Run
 * analysis* button; what the reader wants there is who takes part.
 */
export interface RunPlugin {
  id: string;
  name: string;
  kind: LoadedPluginInfo['kind'];
  source: LoadedPluginInfo['source'];
  /** Whether the pipeline calls this plugin. */
  runs: boolean;
  /** Why it stands by; empty for the ones that run. */
  note: string;
}

/**
 * Who takes part in a run, in the order the workbench loaded them.
 *
 * The rule is the orchestrator's own, not a wish: every language module and
 * every git-metric plugin is called, the **first** commit-convention plugin
 * parses the history and the rest stand by, and an AI provider is never part
 * of an analysis at all. A language module whose extensions match no file in
 * the repository is skipped when the run gets there — that depends on the
 * repository rather than on the registry, so it is not something this list can
 * promise.
 */
export function runPlugins(
  plugins: readonly LoadedPluginInfo[],
): RunPlugin[] {
  let parsing = false;
  return plugins.map((plugin) => {
    const entry = {
      id: plugin.id,
      name: plugin.name,
      kind: plugin.kind,
      source: plugin.source,
    };

    switch (plugin.kind) {
      case 'language':
      case 'git-metric':
        return { ...entry, runs: true, note: '' };
      case 'commit-convention': {
        // First one loaded wins; a second convention would parse the same
        // commits into a second answer.
        const first = !parsing;
        parsing = true;
        return first
          ? { ...entry, runs: true, note: '' }
          : {
              ...entry,
              runs: false,
              note: 'another convention already parses this history',
            };
      }
      case 'ai-provider':
        return {
          ...entry,
          runs: false,
          note: 'answers questions about a report; no part of a run',
        };
      default:
        // A kind this build does not know about: the server loaded it, the
        // pipeline has no step for it.
        return {
          ...entry,
          runs: false,
          note: 'this workbench has no step for it',
        };
    }
  });
}
