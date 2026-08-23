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
 * Which of those settings selects a stage, by what the stage produces.
 *
 * The bridge across the migration: a plugin that becomes a stage stops being a
 * `git-metric` and keeps being what the `metrics` list means. A stage producing
 * something no setting names — a findings list, an aggregate — is not
 * selectable yet and runs, which is what an unconfigured project asks for.
 */
const SELECTED_BY: Partial<
  Record<
    NonNullable<LoadedPluginInfo['produces']>,
    Extract<keyof RunPluginConfig, 'languages' | 'metrics'>
  >
> = {
  graph: 'languages',
  metrics: 'metrics',
};

/**
 * Who takes part in a run over this project, in the order the workbench loaded
 * them.
 *
 * The rule is the orchestrator's own, not a wish. Every language module and
 * every git-metric plugin the project enables is called — a list is an
 * allow-list, and no list at all is all of them. Of an **exclusive group** at
 * most one member runs, and configuration names which: a repository has one
 * commit convention, not several. A language module whose extensions match no
 * file in the repository is skipped when the run gets there — that depends on
 * the repository rather than on the settings, so it is not something this list
 * can promise.
 *
 * What this cannot say is that the run happens at all: a setting naming a
 * plugin nobody loaded fails it outright, and that is `missingPlugins()`'s
 * question rather than this one's. A group of more than one that nothing chose
 * from fails it too, and that one *is* this list's question — every member says
 * so, because the alternative is a confident list in front of a button that is
 * going to fail.
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
      case 'stage': {
        // A stage answers to the setting that names what it produces, for as
        // long as configuration names plugins per kind at all — a metric that
        // has migrated is still switched on and off through `metrics`. The
        // allow-list decides first, exactly as the pipeline lets it.
        if (!selectedBySetting(plugin, config)) {
          return { ...entry, runs: false, note: 'this project leaves it out' };
        }
        return plugin.exclusive
          ? grouped(entry, plugin, plugins, config)
          : { ...entry, runs: true, note: '' };
      }
      case 'language':
        return allowed(entry, config?.languages);
      case 'git-metric':
        return allowed(entry, config?.metrics);
      case 'commit-convention':
        if (plugin.id === parses) return { ...entry, runs: true, note: '' };
        return {
          ...entry,
          runs: false,
          note: conventionNote(plugins, parses),
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
 * Whether the allow-list that names what this stage produces lets it run.
 *
 * A stage producing something no setting names has no list to be left out of,
 * and unnamed means enabled — which is the rule the repository's config file
 * makes general, and the reason installing a stage visibly does something.
 */
function selectedBySetting(
  plugin: LoadedPluginInfo,
  config?: RunPluginConfig | null,
): boolean {
  const setting = plugin.produces ? SELECTED_BY[plugin.produces] : undefined;
  const ids = setting ? config?.[setting] : null;
  return !ids || ids.includes(plugin.id);
}

/**
 * A member of an exclusive group, of which at most one runs.
 *
 * One member needs no choosing — installing a single convention is unambiguous
 * on its own. More than one, and configuration has to name the active member:
 * the core refuses the run rather than picking, because a history reported as
 * conforming to a convention nobody asked for reads exactly like one that
 * conforms.
 */
function grouped(
  entry: Omit<RunPlugin, 'runs' | 'note'>,
  plugin: LoadedPluginInfo,
  plugins: readonly LoadedPluginInfo[],
  config?: RunPluginConfig | null,
): RunPlugin {
  // Only the members that survived the allow-lists: leaving one out settles a
  // group of two, exactly as it does in the pipeline.
  const members = plugins.filter(
    (other) =>
      other.exclusive === plugin.exclusive && selectedBySetting(other, config),
  );
  if (members.length < 2) return { ...entry, runs: true, note: '' };

  const named = namedIds(config);
  const chosen = members.filter((member) => named.includes(member.id));
  if (chosen.length !== 1) {
    return {
      ...entry,
      runs: false,
      note: `this project chooses none of the ${members.length} plugins in "${plugin.exclusive}", so no run starts`,
    };
  }
  if (chosen[0]?.id === entry.id) return { ...entry, runs: true, note: '' };
  return {
    ...entry,
    runs: false,
    note: `this project runs ${chosen[0]?.name} instead`,
  };
}

/** Every plugin id this project's settings name, whatever setting names it. */
function namedIds(config?: RunPluginConfig | null): string[] {
  return [
    ...(config?.languages ?? []),
    ...(config?.metrics ?? []),
    ...(config?.convention ? [config.convention] : []),
  ];
}

/**
 * Which convention of the **older kind** will parse in the core, or `null` when
 * none will: a project naming one that is no longer installed gets no run at
 * all rather than a fallback to another, and a convention that has migrated to
 * a stage is run by the scheduler instead, which leaves the ones that have not
 * with nothing to parse.
 */
function parsingConvention(
  plugins: readonly LoadedPluginInfo[],
  chosen: string | null,
): string | null {
  if (plugins.some((p) => p.kind === 'stage' && p.produces === 'commits')) {
    return null;
  }
  const conventions = plugins.filter((p) => p.kind === 'commit-convention');
  if (!chosen) return conventions[0]?.id ?? null;
  return conventions.some((p) => p.id === chosen) ? chosen : null;
}

/** Why a convention of the older kind is not the one parsing this history. */
function conventionNote(
  plugins: readonly LoadedPluginInfo[],
  parses: string | null,
): string {
  if (parses) return 'another convention already parses this history';
  if (plugins.some((p) => p.kind === 'stage' && p.produces === 'commits')) {
    return 'a convention stage already parses this history';
  }
  return 'this project names a convention nobody loaded, so no run starts';
}

function allowed(
  entry: Omit<RunPlugin, 'runs' | 'note'>,
  ids: readonly string[] | null | undefined,
): RunPlugin {
  if (!ids || ids.includes(entry.id)) return { ...entry, runs: true, note: '' };
  return { ...entry, runs: false, note: 'this project leaves it out' };
}
