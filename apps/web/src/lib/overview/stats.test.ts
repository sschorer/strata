import { describe, expect, it } from 'vitest';
import type { AnalysisReport } from '$lib/api';
import { dependenciesOf } from '$lib/test/graph';
import { overviewStats, type StatCard } from './stats';

const report = {
  rev: '4fea7c5deadbeef',
  run: {
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-15T11:55:00.000Z',
  },
  languages: {
    typescript: {
      graph: { nodes: [], edges: [], cycles: [] },
      deadCode: [
        { path: 'src/barrel.ts', reason: 'unreferenced-export' },
        { path: 'src/old.ts', reason: 'unreachable-file' },
      ],
      metrics: [{ path: 'src/big.ts', loc: 940 }],
      summary: {
        nodes: 120,
        edges: 300,
        cycles: 2,
        cycleNodes: 5,
        maxFanIn: null,
        maxFanOut: null,
      },
    },
  },
  // The cycle card reads the run's own fold across every language.
  dependencies: dependenciesOf({
    summary: {
      nodes: 120,
      edges: 300,
      cycles: 2,
      cycleNodes: 5,
      maxFanIn: null,
      maxFanOut: null,
    },
  }),
  metrics: [
    {
      id: 'hotspots',
      label: 'Hotspots (churn × complexity)',
      points: [
        { subject: 'src/big.ts', value: 1900, meta: { churn: 19, complexity: 100 } },
        { subject: 'src/mid.ts', value: 300, meta: { churn: 10, complexity: 30 } },
      ],
    },
  ],
  commits: [
    { type: 'feat', scope: null, breaking: false, subject: 'a', tags: {}, valid: true },
    { type: 'fix', scope: null, breaking: true, subject: 'b', tags: {}, valid: true },
  ],
  cache: {
    enabled: false,
    hits: 0,
    misses: 0,
    runHits: 0,
    runMisses: 0,
    writes: 0,
  },
} as unknown as AnalysisReport;

const cardsOf = (over: AnalysisReport = report, loaded: number | null = 4) =>
  new Map<string, StatCard>(
    overviewStats(over, { loaded, failures: 0 }).map((card) => [
      card.key,
      card,
    ]),
  );

describe('overviewStats', () => {
  it('is the six cards, in the order the row prints them', () => {
    expect(overviewStats(report, { loaded: 4, failures: 0 }).map((c) => c.key))
      .toEqual([
        'files',
        'hotspot',
        'cycles',
        'commits',
        'dead-code',
        'plugins',
      ]);
  });

  it('prints the run, the top hotspot and the cycle count', () => {
    const cards = cardsOf();

    expect(cards.get('files')).toMatchObject({
      value: '1.2k',
      hint: 'typescript',
    });
    // The name is what fits on a card; the path stays in the tooltip.
    expect(cards.get('hotspot')).toMatchObject({
      value: 'big.ts',
      hint: 'score 1.9k',
      title: 'src/big.ts',
      href: '/hotspots',
    });
    expect(cards.get('cycles')).toMatchObject({
      value: '2',
      hint: '5 files',
      tone: 'danger',
      href: '/graph',
    });
  });

  it('leads the commit card with what breaks and the dead-code card with files', () => {
    const cards = cardsOf();

    expect(cards.get('commits')).toMatchObject({
      value: '2',
      hint: '1 breaking',
      tone: 'warn',
    });
    expect(cards.get('dead-code')).toMatchObject({
      value: '2',
      hint: '2 files',
      tone: 'warn',
    });
  });

  it('counts conventional commits when nothing breaks', () => {
    const calm = {
      ...report,
      commits: report.commits.map((commit) => ({ ...commit, breaking: false })),
    } as AnalysisReport;

    expect(cardsOf(calm).get('commits')).toMatchObject({
      hint: '2 conventional',
      tone: 'plain',
    });
  });

  it('reads a clean report as none rather than as nothing', () => {
    const clean = {
      ...report,
      languages: {},
      dependencies: dependenciesOf(),
      metrics: [],
      commits: [],
    } as unknown as AnalysisReport;
    const cards = cardsOf(clean);

    expect(cards.get('files')!.hint).toBe('no language analysed');
    expect(cards.get('hotspot')).toMatchObject({ value: '—', hint: 'no scores' });
    expect(cards.get('cycles')).toMatchObject({
      value: '0',
      hint: 'none',
      tone: 'plain',
    });
    expect(cards.get('dead-code')).toMatchObject({ hint: 'none', tone: 'plain' });
  });

  it('names every language when more than one ran', () => {
    const polyglot = {
      ...report,
      languages: { ...report.languages, python: report.languages.typescript },
    } as AnalysisReport;

    expect(cardsOf(polyglot).get('files')!.hint).toBe('2 languages');
  });

  it('waits for the plugin response rather than printing a zero', () => {
    expect(cardsOf(report, null).get('plugins')).toMatchObject({
      value: '—',
      hint: 'loading…',
    });
  });

  it('warns about plugins that were found but not loaded', () => {
    const [card] = overviewStats(report, { loaded: 4, failures: 1 }).filter(
      (entry) => entry.key === 'plugins',
    );

    expect(card).toMatchObject({ value: '4', hint: '1 skipped', tone: 'warn' });
  });

  it('stays printable when a report carries no run summary', () => {
    const bare = { ...report, run: undefined } as unknown as AnalysisReport;

    expect(cardsOf(bare).get('files')!.value).toBe('0');
  });
});
