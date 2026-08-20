import type { LoadedPluginInfo, ProjectConfig } from '$lib/api';

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

/** The half of a project's config that decides who takes part. */
export type RunPluginConfig = Pick<
  ProjectConfig,
  'languages' | 'metrics' | 'convention'
>;

/**
 * Who takes part in a run over this project, in the order the workbench loaded
 * them.
 *
 * The rule is the orchestrator's own, not a wish. Every language module and
 * every git-metric plugin the project enables is called — a list is an
 * allow-list, and no list at all is all of them; one commit convention parses
 * the history, the one the project chose or else the first registered. A
 * language module whose extensions match no file in the repository is skipped
 * when the run gets there — that depends on the repository rather than on the
 * settings, so it is not something this list can promise.
 *
 * Without a config — a project whose settings have not arrived yet — the answer
 * is the unconfigured one, which is what such a run would do.
 */
export function runPlugins(
  plugins: readonly LoadedPluginInfo[],
  config?: RunPluginConfig | null,
): RunPlugin[] {
  const parses = parsingConvention(plugins, config?.convention ?? null);
  return plugins.map((plugin) => {
    const entry = {
      id: plugin.id,
      name: plugin.name,
      kind: plugin.kind,
      source: plugin.source,
    };

    switch (plugin.kind) {
      case 'language':
        return allowed(entry, config?.languages);
      case 'git-metric':
        return allowed(entry, config?.metrics);
      case 'commit-convention':
        if (plugin.id === parses) return { ...entry, runs: true, note: '' };
        return {
          ...entry,
          runs: false,
          note: parses
            ? 'another convention already parses this history'
            : 'this project chose a convention nobody loaded',
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

/**
 * Which convention will actually parse, or `null` when none will — a project
 * naming one that is no longer installed parses nothing rather than falling
 * back to another, so every loaded convention stands by and says why.
 */
function parsingConvention(
  plugins: readonly LoadedPluginInfo[],
  chosen: string | null,
): string | null {
  const conventions = plugins.filter((p) => p.kind === 'commit-convention');
  if (!chosen) return conventions[0]?.id ?? null;
  return conventions.some((p) => p.id === chosen) ? chosen : null;
}

function allowed(
  entry: Omit<RunPlugin, 'runs' | 'note'>,
  ids: readonly string[] | null | undefined,
): RunPlugin {
  if (!ids || ids.includes(entry.id)) return { ...entry, runs: true, note: '' };
  return { ...entry, runs: false, note: 'this project leaves it out' };
}
