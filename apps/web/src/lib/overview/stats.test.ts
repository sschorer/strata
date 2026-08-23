import { describe, expect, it } from 'vitest';
import type { ParsedCommit, StageEntry } from '@strata/sdk';
import type { AnalysisReport } from '$lib/api';
import { HOTSPOT_STAGE_ID } from '$lib/hotspots';
import { dependenciesOf, graphOf, languageOf } from '$lib/test/graph';
import { reportOf } from '$lib/test/report';
import { failedStage, okStage, skippedStage } from '$lib/test/stages';
import type { StatCard } from './card';
import { overviewStats } from './stats';

const TYPESCRIPT = 'strata-language-typescript';
const CONVENTION = 'strata-commit-conventional';

const commits: ParsedCommit[] = [
  { type: 'feat', scope: null, breaking: false, subject: 'a', tags: {}, valid: true },
  { type: 'fix', scope: null, breaking: true, subject: 'b', tags: {}, valid: true },
];

/** Everything a full run said, so a test can replace one stage of it. */
const stages = (over: Record<string, StageEntry> = {}) => ({
  [TYPESCRIPT]: okStage('graph', {
    ...languageOf(graphOf('')),
    deadCode: [
      { path: 'src/barrel.ts', reason: 'unreferenced-export' as const },
      { path: 'src/old.ts', reason: 'unreachable-file' as const },
    ],
    metrics: [{ path: 'src/big.ts', loc: 940 }],
  }),
  [HOTSPOT_STAGE_ID]: okStage('metrics', {
    id: 'hotspots',
    label: 'Hotspots (churn × complexity)',
    points: [
      { subject: 'src/big.ts', value: 1900, meta: { churn: 19, complexity: 100 } },
      { subject: 'src/mid.ts', value: 300, meta: { churn: 10, complexity: 30 } },
    ],
  }),
  [CONVENTION]: okStage('commits', commits),
  ...over,
});

const report = reportOf({
  rev: '4fea7c5deadbeef',
  run: {
    status: 'ok',
    branch: 'main',
    files: 1240,
    durationMs: 2440,
    finishedAt: '2026-08-15T11:55:00.000Z',
  },
  // The cycle card reads the run's own fold across every graph stage.
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
  stages: stages(),
});

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
      hint: TYPESCRIPT,
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
    const calm = reportOf({
      ...report,
      stages: stages({
        [CONVENTION]: okStage(
          'commits',
          commits.map((commit) => ({ ...commit, breaking: false })),
        ),
      }),
    });

    expect(cardsOf(calm).get('commits')).toMatchObject({
      hint: '2 conventional',
      tone: 'plain',
    });
  });

  it('reads stages that ran and found nothing as none rather than as nothing', () => {
    const quiet = reportOf({
      dependencies: dependenciesOf(),
      stages: {
        [TYPESCRIPT]: okStage('graph', languageOf(graphOf(''))),
        [HOTSPOT_STAGE_ID]: okStage('metrics', {
          id: 'hotspots',
          label: 'Hotspots',
          points: [],
        }),
        [CONVENTION]: okStage('commits', []),
      },
    });
    const cards = cardsOf(quiet);

    expect(cards.get('hotspot')).toMatchObject({ value: '—', hint: 'no scores' });
    expect(cards.get('cycles')).toMatchObject({
      value: '0',
      hint: 'none',
      tone: 'plain',
    });
    expect(cards.get('commits')).toMatchObject({
      value: '0',
      hint: '0 conventional',
      tone: 'plain',
    });
    expect(cards.get('dead-code')).toMatchObject({
      value: '0',
      hint: 'none',
      tone: 'plain',
    });
  });

  it('says a stage failed where its number would have been', () => {
    const partial = reportOf({
      ...report,
      stages: stages({
        [TYPESCRIPT]: failedStage('graph', 'tsconfig.json is not readable'),
      }),
    });
    const cards = cardsOf(partial);

    // Nothing built a graph, so neither number is knowable — and a card that
    // printed `0` would read as a repository with no cycles and no dead code.
    expect(cards.get('cycles')).toMatchObject({
      value: '—',
      hint: '1 stage failed',
      tone: 'danger',
    });
    expect(cards.get('dead-code')).toMatchObject({
      value: '—',
      hint: '1 stage failed',
      tone: 'danger',
    });
    expect(cards.get('files')!.hint).toBe('no language analysed');
  });

  it('keeps what half a run measured, and says it is half', () => {
    const partial = reportOf({
      ...report,
      stages: stages({
        'acme-language-python': failedStage('graph', 'parser exploded'),
      }),
    });

    // Still `danger`: the card never talks its own trouble down to the tone
    // the number alone would have had.
    expect(cardsOf(partial).get('dead-code')).toMatchObject({
      value: '2',
      hint: '2 files · 1 stage failed',
      tone: 'danger',
    });
  });

  it('tells a stage that never ran from one that failed', () => {
    const blocked = reportOf({
      ...report,
      stages: stages({
        [HOTSPOT_STAGE_ID]: skippedStage(
          'metrics',
          `"${CONVENTION}" failed, and this stage consumes what it produces`,
          CONVENTION,
        ),
      }),
    });

    expect(cardsOf(blocked).get('hotspot')).toMatchObject({
      value: '—',
      hint: '1 stage did not run',
      tone: 'warn',
    });
  });

  it('prints an absence rather than a zero for a stage nobody installed', () => {
    const cards = cardsOf(reportOf());

    expect(cards.get('cycles')).toMatchObject({
      value: '—',
      hint: 'no stage produced a graph',
      tone: 'plain',
    });
    expect(cards.get('hotspot')).toMatchObject({
      value: '—',
      hint: 'no hotspot stage',
      tone: 'plain',
    });
    expect(cards.get('commits')).toMatchObject({
      value: '—',
      hint: 'no convention stage',
      tone: 'plain',
    });
  });

  it('names every language when more than one stage built a graph', () => {
    const polyglot = reportOf({
      ...report,
      stages: stages({
        'acme-language-python': okStage('graph', languageOf(graphOf(''))),
      }),
    });

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
