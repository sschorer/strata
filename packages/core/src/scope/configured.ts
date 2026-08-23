/** The half of a run's configuration that names plugins by id. */
export interface NamedPlugins {
  languages?: readonly string[] | null;
  metrics?: readonly string[] | null;
  convention?: string | null;
}

/**
 * Every plugin id this run's configuration named, whatever setting carried it.
 *
 * What settles an **exclusive group**: a setting names a plugin, a stage is in
 * the group its own manifest declared, and the core needs to know neither what
 * a group means nor which setting a member answers to in order to see that it
 * was chosen (`docs/adr/0010`).
 *
 * Only what was actually named. Naming nothing is *every* plugin to an
 * allow-list, but it is **no choice** to a group — and reaching for load order
 * there would be the core picking the member the group exists to make somebody
 * pick for themselves.
 */
export function namedPlugins(config: NamedPlugins): string[] {
  return [
    ...(config.languages ?? []),
    ...(config.metrics ?? []),
    ...(config.convention ? [config.convention] : []),
  ];
}
