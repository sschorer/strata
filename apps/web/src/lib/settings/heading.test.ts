import { describe, expect, it } from 'vitest';
import { scopeHeading } from './heading';

const strata = { name: 'Strata', root: '/home/dev/workspace/strata' };

describe('scopeHeading', () => {
  it('names the project the settings belong to, and its root', () => {
    const heading = scopeHeading('project', strata);

    expect(heading.title).toBe('Project settings');
    expect(heading.subject).toBe('Strata');
    expect(heading.detail).toBe('/home/dev/workspace/strata');
    expect(heading.summary).toContain('Strata');
  });

  it('says so when there is no project to scope to', () => {
    const heading = scopeHeading('project', null);

    expect(heading.subject).toBe('No project selected');
    expect(heading.detail).toBe('');
    expect(heading.summary).toContain('switcher');
  });

  it('scopes the app settings to the workbench, whatever project is open', () => {
    const heading = scopeHeading('app', strata);

    expect(heading.title).toBe('App settings');
    expect(heading.subject).toBe('This workbench');
    // The project is open, but it is not what these settings reach.
    expect(heading.detail).toBe('');
    expect(heading.summary).not.toContain('Strata');
  });
});
