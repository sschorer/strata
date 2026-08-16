import { describe, expect, it } from 'vitest';
import { activeNav, ANALYSIS_NAV, sectionLabel, SETTINGS_NAV } from './nav';

describe('nav', () => {
  it('lists the analysis screens and the two settings scopes', () => {
    expect(ANALYSIS_NAV.map((item) => item.label)).toEqual([
      'Overview',
      'Hotspots',
      'Dependencies',
      'Commits',
      'Dead code',
    ]);
    expect(SETTINGS_NAV.map((item) => item.label)).toEqual([
      'Project settings',
      'App settings',
    ]);
  });

  it('marks screens that are not built yet as planned', () => {
    expect(ANALYSIS_NAV.find((item) => item.href === '/graph')?.status).toBe(
      'ready',
    );
    expect(ANALYSIS_NAV.find((item) => item.href === '/commits')?.status).toBe(
      'planned',
    );
  });

  it('opens both settings scopes', () => {
    expect(SETTINGS_NAV.every((item) => item.status === 'ready')).toBe(true);
  });

  it('finds the entry a path is on', () => {
    expect(activeNav('/hotspots')?.label).toBe('Hotspots');
    expect(activeNav('/hotspots/')?.label).toBe('Hotspots');
    expect(activeNav('/')?.label).toBe('Overview');
  });

  it('keeps the root entry from swallowing every other path', () => {
    expect(activeNav('/graph')?.href).toBe('/graph');
  });

  it('highlights the section a sub-page belongs to', () => {
    expect(activeNav('/settings/project/scope')?.label).toBe(
      'Project settings',
    );
  });

  it('answers within the list it is given', () => {
    const sections = [
      { href: '/settings/app/appearance', label: 'Appearance' },
      { href: '/settings/app/about', label: 'About' },
    ].map((item) => ({ ...item, status: 'planned' as const }));

    expect(activeNav('/settings/app/about', sections)?.label).toBe('About');
    // The scope's own route is not one of its sections.
    expect(activeNav('/settings/app', sections)).toBeNull();
  });

  it('names the section, and falls back on an unknown path', () => {
    expect(sectionLabel('/graph')).toBe('Dependencies');
    expect(sectionLabel('/nowhere')).toBe('Workbench');
    expect(activeNav('/nowhere')).toBeNull();
  });
});
