import { describe, expect, it } from 'vitest';
import { pathCrumbs } from './crumbs';

describe('pathCrumbs', () => {
  it('walks from the browse root down to the folder', () => {
    expect(pathCrumbs('/home/dev/work/strata', ['/home/dev'])).toEqual([
      { label: 'dev', path: '/home/dev' },
      { label: 'work', path: '/home/dev/work' },
      { label: 'strata', path: '/home/dev/work/strata' },
    ]);
  });

  it('stops at the root — above one is not browsable', () => {
    const crumbs = pathCrumbs('/repos/strata', ['/repos']);

    expect(crumbs[0]).toEqual({ label: 'repos', path: '/repos' });
    expect(crumbs).toHaveLength(2);
  });

  it('picks the root the folder is actually inside', () => {
    const crumbs = pathCrumbs('/repos/team/app', ['/repos', '/repos/team']);

    expect(crumbs[0]?.path).toBe('/repos/team');
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['team', 'app']);
  });

  it('handles a root that is the filesystem root', () => {
    expect(pathCrumbs('/srv/code', ['/'])).toEqual([
      { label: '/', path: '/' },
      { label: 'srv', path: '/srv' },
      { label: 'code', path: '/srv/code' },
    ]);
  });

  it('falls back to the path itself when no root matches', () => {
    expect(pathCrumbs('/mnt/data', ['/home/dev'])).toEqual([
      { label: '/mnt/data', path: '/mnt/data' },
    ]);
    expect(pathCrumbs('', ['/home/dev'])).toEqual([]);
  });
});
