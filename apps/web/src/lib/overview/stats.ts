import type { AnalysisReport } from '$lib/api';
import { compactNumber, fileName } from '$lib/format';
import { hotspotRows } from '$lib/hotspots';
import { commitTotals } from './commits';
import { deadCodeCount } from './dead-code';

/** How a card's number reads: plainly, as something to watch, as a problem. */
export type StatTone = 'plain' | 'warn' | 'danger';

/** One of the six cards across the top of the overview. */
export interface StatCard {
  /** Stable identity: what `each` keys on and what a test looks a card up by. */
  key: string;
  label: string;
  /** Already formatted — a card prints strings, it never does arithmetic. */
  value: string;
  hint: string;
  tone: StatTone;
  /** The full text behind a truncated value, when there is more of it. */
  title?: string;
  /** The screen that shows this number in full, where one is built. */
  href?: string;
}

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
  // The cycle card reads what the run counted: the same fold the dependency
  // screen prints, so the two never disagree about how many knots there are.
  const graph = report.dependencies.summary;
  const top = hotspotRows(report)[0];
  const commits = commitTotals(report.commits);
  const dead = deadCodeCount(report);

  return [
    {
      key: 'files',
      label: 'Files',
      value: compactNumber(run?.files ?? 0),
      hint: languageHint(report),
      tone: 'plain',
    },
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
      key: 'cycles',
      label: 'Import cycles',
      value: compactNumber(graph.cycles),
      hint: graph.cycles > 0 ? `${graph.cycleNodes} files` : 'none',
      tone: graph.cycles > 0 ? 'danger' : 'plain',
      href: '/graph',
    },
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
      key: 'dead-code',
      label: 'Dead code',
      value: compactNumber(dead.findings),
      hint: dead.findings > 0 ? `${dead.files} files` : 'none',
      tone: dead.findings > 0 ? 'warn' : 'plain',
    },
    {
      key: 'plugins',
      label: 'Plugins',
      value: plugins.loaded === null ? '—' : compactNumber(plugins.loaded),
      hint: pluginHint(plugins),
      tone: plugins.failures > 0 ? 'warn' : 'plain',
    },
  ];
}

/** Which languages the run had a plugin for — the file count's context. */
function languageHint(report: AnalysisReport): string {
  const names = Object.keys(report.languages);
  if (names.length === 0) return 'no language analysed';
  if (names.length === 1) return names[0]!;
  return `${names.length} languages`;
}

function pluginHint(plugins: PluginTally): string {
  if (plugins.loaded === null) return 'loading…';
  if (plugins.failures > 0) return `${plugins.failures} skipped`;
  return 'all loaded';
}
