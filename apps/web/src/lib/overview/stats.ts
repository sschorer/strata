import type { AnalysisReport } from '$lib/api';
import { compactNumber, fileName } from '$lib/format';
import { HOTSPOT_STAGE_ID, hotspotRows } from '$lib/hotspots';
import {
  outputOf,
  outputsProducing,
  soleOutputOf,
  troubleOf,
  troublesProducing,
} from '$lib/stages';
import type { StatCard } from './card';
import { commitTotals } from './commits';
import { deadCodeCount } from './dead-code';
import { stageCard } from './stage-card';

/** What the plugin store knows, as the last card reads it. */
export interface PluginTally {
  /** How many loaded; `null` until the response arrives. */
  loaded: number | null;
  failures: number;
}

/**
 * The report, folded into the six numbers the overview leads with.
 *
 * One function rather than six, because the cards are one row: they are
 * ordered, they share a shape, and a screen that prints them should not have
 * to know which part of the report each one came from.
 *
 * Five of them come from **stage entries** — read by output type, and by
 * producer id only where a card means one specific stage — so each is built
 * from what the stages actually said and then handed to `stageCard`, which
 * decides how it reads when some of them said nothing (`docs/adr/0015`).
 *
 * Plugins are the exception the signature makes explicit — how many loaded is
 * a fact about the workbench, not about the analysed repository, so it arrives
 * as an argument instead of being dug out of the report.
 */
export function overviewStats(
  report: AnalysisReport,
  plugins: PluginTally,
): StatCard[] {
  // Every report the server sends carries a run summary; the fallback keeps the
  // card printable rather than blank if one ever arrives without.
  const run = report.run as AnalysisReport['run'] | undefined;
  // The graph stages feed three of the cards: the file count's context, the
  // cycles the run folded, and the dead code they found on the way.
  const graphs = outputsProducing(report, 'graph');
  const graphTroubles = troublesProducing(report, 'graph');
  const graphState = {
    produced: graphs.length > 0,
    troubles: graphTroubles,
    absent: 'no stage produced a graph',
  };
  // The cycle card reads what the run folded over those graphs: the same
  // answer the dependency screen prints, so the two never disagree about how
  // many knots there are.
  const graph = report.dependencies.summary;
  const hotspots = troubleOf(report, HOTSPOT_STAGE_ID);
  const top = hotspotRows(report)[0];
  const parsed = soleOutputOf(report, 'commits');
  const commitTroubles = troublesProducing(report, 'commits');
  const commits = commitTotals(parsed ?? []);
  const dead = deadCodeCount(report);

  return [
    {
      key: 'files',
      label: 'Files',
      // What the run scanned, not what any one stage made of it: a graph stage
      // that threw does not make the repository smaller.
      value: compactNumber(run?.files ?? 0),
      hint: languageHint(graphs.map(({ id }) => id)),
      tone: 'plain',
    },
    stageCard(
      {
        key: 'hotspot',
        label: 'Top hotspot',
        value: top ? fileName(top.path) : '—',
        hint: top ? `score ${compactNumber(top.score)}` : 'no scores',
        tone: 'plain',
        title: top?.path,
        href: '/hotspots',
      },
      {
        produced: outputOf(report, HOTSPOT_STAGE_ID, 'metrics') !== null,
        troubles: hotspots ? [hotspots] : [],
        absent: 'no hotspot stage',
      },
    ),
    stageCard(
      {
        key: 'cycles',
        label: 'Import cycles',
        value: compactNumber(graph.cycles),
        hint: graph.cycles > 0 ? `${graph.cycleNodes} files` : 'none',
        tone: graph.cycles > 0 ? 'danger' : 'plain',
        href: '/graph',
      },
      graphState,
    ),
    stageCard(
      {
        key: 'commits',
        label: 'Commits',
        value: compactNumber(commits.total),
        hint:
          commits.breaking > 0
            ? `${commits.breaking} breaking`
            : `${commits.valid} conventional`,
        tone: commits.breaking > 0 ? 'warn' : 'plain',
      },
      {
        produced: parsed !== null,
        troubles: commitTroubles,
        absent: 'no convention stage',
      },
    ),
    stageCard(
      {
        key: 'dead-code',
        label: 'Dead code',
        value: compactNumber(dead.findings),
        hint: dead.findings > 0 ? `${dead.files} files` : 'none',
        tone: dead.findings > 0 ? 'warn' : 'plain',
      },
      graphState,
    ),
    {
      key: 'plugins',
      label: 'Plugins',
      value: plugins.loaded === null ? '—' : compactNumber(plugins.loaded),
      hint: pluginHint(plugins),
      tone: plugins.failures > 0 ? 'warn' : 'plain',
    },
  ];
}

/** Which stages analysed the files into a graph — the file count's context. */
function languageHint(ids: readonly string[]): string {
  if (ids.length === 0) return 'no language analysed';
  if (ids.length === 1) return ids[0]!;
  return `${ids.length} languages`;
}

function pluginHint(plugins: PluginTally): string {
  if (plugins.loaded === null) return 'loading…';
  if (plugins.failures > 0) return `${plugins.failures} skipped`;
  return 'all loaded';
}
