import type { NavStatus } from '$lib/shell/nav';
import type { SettingsScope } from './scope';

/**
 * The sections each scope holds. Like the workbench nav, sections that are on
 * the backlog are listed and inert: the settings area is a map of what can be
 * configured, and a map with holes in it reads as something broken rather than
 * something coming.
 */
export interface SettingsSection {
  /** Route the section will live at; also its identity in the list. */
  href: string;
  label: string;
  /** One line on what it holds — the landing screen prints it. */
  description: string;
  status: NavStatus;
}

/** Everything scoped to one repository. */
export const PROJECT_SECTIONS: readonly SettingsSection[] = [
  {
    href: '/settings/project/general',
    label: 'General',
    description:
      'Display name, the root it is mounted at, the revision to analyse and how far back the history is read.',
    status: 'ready',
  },
  {
    href: '/settings/project/analyze',
    label: 'Analyze / run',
    description:
      'Start a run over this project, see which plugins will take part, and what the recent runs found.',
    status: 'ready',
  },
  {
    href: '/settings/project/scope',
    label: 'Scope & ignore',
    description:
      'The paths that are analysed and the globs that are skipped, as editable lists.',
    status: 'planned',
  },
  {
    href: '/settings/project/languages',
    label: 'Language plugins',
    description:
      'Which language modules run over this project, and the extensions each one claims.',
    status: 'planned',
  },
  {
    href: '/settings/project/metrics',
    label: 'Metrics & convention',
    description:
      'Which metrics are computed, and the commit convention the history is read with.',
    status: 'planned',
  },
  {
    href: '/settings/project/rules',
    label: 'Architecture rules',
    description:
      'The import rules this project is held to — “ui may not import db” — and which of them are enforced.',
    status: 'planned',
  },
  {
    href: '/settings/project/danger',
    label: 'Danger zone',
    description:
      'Remove the project from Strata. The repository on disk is left untouched.',
    status: 'planned',
  },
];

/** Everything that holds for the workbench, whatever project is open. */
export const APP_SECTIONS: readonly SettingsSection[] = [
  {
    href: '/settings/app/appearance',
    label: 'Appearance',
    description: 'Theme — dark, light or system — and the density of a screen.',
    status: 'planned',
  },
  {
    href: '/settings/app/plugins',
    label: 'Plugins & engine',
    description:
      'The plugins directory, whether third-party plugins load, and the incremental cache.',
    status: 'planned',
  },
  {
    href: '/settings/app/gates',
    label: 'CI gates',
    description:
      'What a headless run fails on: new import cycles, a hotspot regression past a threshold.',
    status: 'planned',
  },
  {
    href: '/settings/app/ai',
    label: 'AI providers',
    description:
      'The coding agents Strata may talk to, how each one is launched, and how often it is health-checked.',
    status: 'planned',
  },
  {
    href: '/settings/app/about',
    label: 'About',
    description: 'Version, licence, and the links to the docs.',
    status: 'planned',
  },
];

export function sectionsFor(scope: SettingsScope): readonly SettingsSection[] {
  return scope === 'project' ? PROJECT_SECTIONS : APP_SECTIONS;
}
