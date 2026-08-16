import { describe, expect, it } from 'vitest';
import { settingsScope } from './scope';
import { APP_SECTIONS, PROJECT_SECTIONS, sectionsFor } from './sections';

describe('settings sections', () => {
  it('lists the project scope in the order the settings area is read', () => {
    expect(PROJECT_SECTIONS.map((section) => section.label)).toEqual([
      'General',
      'Analyze / run',
      'Scope & ignore',
      'Language plugins',
      'Metrics & convention',
      'Architecture rules',
      'Danger zone',
    ]);
  });

  it('lists the app scope', () => {
    expect(APP_SECTIONS.map((section) => section.label)).toEqual([
      'Appearance',
      'Plugins & engine',
      'CI gates',
      'AI providers',
      'About',
    ]);
  });

  it('hands each scope its own sections', () => {
    expect(sectionsFor('project')).toBe(PROJECT_SECTIONS);
    expect(sectionsFor('app')).toBe(APP_SECTIONS);
  });

  it('keeps every section inside the scope that lists it', () => {
    for (const section of PROJECT_SECTIONS) {
      expect(settingsScope(section.href)).toBe('project');
    }
    for (const section of APP_SECTIONS) {
      expect(settingsScope(section.href)).toBe('app');
    }
  });

  it('says what each section holds, and none is built yet', () => {
    for (const section of [...PROJECT_SECTIONS, ...APP_SECTIONS]) {
      expect(section.description.length).toBeGreaterThan(0);
      expect(section.status).toBe('planned');
    }
  });
});
