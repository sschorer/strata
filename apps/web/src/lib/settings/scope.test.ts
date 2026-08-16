import { describe, expect, it } from 'vitest';
import { settingsScope, SETTINGS_ROOTS } from './scope';

describe('settingsScope', () => {
  it('names the scope a settings route is in', () => {
    expect(settingsScope(SETTINGS_ROOTS.project)).toBe('project');
    expect(settingsScope(SETTINGS_ROOTS.app)).toBe('app');
  });

  it('holds the scope across its sections and a trailing slash', () => {
    expect(settingsScope('/settings/project/scope')).toBe('project');
    expect(settingsScope('/settings/app/appearance')).toBe('app');
    expect(settingsScope('/settings/project/')).toBe('project');
  });

  it('leaves every workbench screen alone', () => {
    expect(settingsScope('/')).toBeNull();
    expect(settingsScope('/hotspots')).toBeNull();
    expect(settingsScope('/graph')).toBeNull();
  });

  it('claims nothing on a path that only looks like one', () => {
    expect(settingsScope('/settings')).toBeNull();
    expect(settingsScope('/settings/nowhere')).toBeNull();
    // A sibling route, not a section of the project scope.
    expect(settingsScope('/settings/projects')).toBeNull();
  });
});
