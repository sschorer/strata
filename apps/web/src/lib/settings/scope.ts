/**
 * Settings are two scopes rather than one screen: what a single project does,
 * and what the workbench does for every project. Which scope a route is in
 * decides what the rail lists, so it is a pure function of the path — the
 * frame asks it on every navigation and nothing else needs to be told.
 */
export type SettingsScope = 'project' | 'app';

/** Where each scope roots; its sections hang below it. */
export const SETTINGS_ROOTS: Readonly<Record<SettingsScope, string>> = {
  project: '/settings/project',
  app: '/settings/app',
};

export const SETTINGS_SCOPES = ['project', 'app'] as const;

/** The scope a path sits in — `null` on every workbench screen. */
export function settingsScope(pathname: string): SettingsScope | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  for (const scope of SETTINGS_SCOPES) {
    const root = SETTINGS_ROOTS[scope];
    if (path === root || path.startsWith(`${root}/`)) return scope;
  }
  return null;
}
