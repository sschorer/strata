/**
 * What the rail lists, in order. Screens that are on the backlog but not built
 * are listed too, disabled: the shell is the map of the workbench, and a map
 * with holes in it reads as something broken rather than something coming.
 */
export type NavStatus = 'ready' | 'planned';

export interface NavItem {
  /** Route the entry points at; also its identity in the list. */
  href: string;
  label: string;
  status: NavStatus;
}

/** The analysis screens — one run, read five ways. */
export const ANALYSIS_NAV: readonly NavItem[] = [
  { href: '/', label: 'Overview', status: 'ready' },
  { href: '/hotspots', label: 'Hotspots', status: 'ready' },
  { href: '/graph', label: 'Dependencies', status: 'ready' },
  { href: '/commits', label: 'Commits', status: 'planned' },
  { href: '/dead-code', label: 'Dead code', status: 'planned' },
];

/** The two settings scopes: what this project does, and what the app does. */
export const SETTINGS_NAV: readonly NavItem[] = [
  { href: '/settings/project', label: 'Project settings', status: 'planned' },
  { href: '/settings/app', label: 'App settings', status: 'planned' },
];

export const NAV_ITEMS: readonly NavItem[] = [
  ...ANALYSIS_NAV,
  ...SETTINGS_NAV,
];

/**
 * The entry a path sits inside. The longest matching href wins, so a future
 * `/settings/project/scope` highlights *Project settings* rather than falling
 * back to the root entry.
 */
export function activeNav(pathname: string): NavItem | null {
  const path = normalise(pathname);
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    if (!contains(item.href, path)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

/** What the breadcrumb calls the current screen. */
export function sectionLabel(pathname: string): string {
  return activeNav(pathname)?.label ?? 'Workbench';
}

/** `/` matches only itself — every path is below it otherwise. */
function contains(href: string, path: string): boolean {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

function normalise(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}
