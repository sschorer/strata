import type { GraphSummary } from '@strata/sdk';
import type { AnalysisReport } from '$lib/api';

/**
 * The numbers above the canvas, folded out of the report.
 *
 * Every language result carries its own `GraphSummary`, counted by the plugin
 * over the graph it built; the browser only adds them up. Language plugins
 * claim disjoint extensions, so their file sets are disjoint and the counts
 * simply sum — the same assumption `mergedGraph` makes, except that the merge
 * also deduplicates, so two plugins claiming one extension would be counted
 * twice here and drawn once there.
 *
 * A report with no language results summarises to zeroes rather than to
 * nothing: the panel renders the same either way.
 */
export function reportSummary(report: AnalysisReport): GraphSummary {
  const summary: GraphSummary = {
    nodes: 0,
    edges: 0,
    cycles: 0,
    cycleNodes: 0,
    maxFanIn: null,
    maxFanOut: null,
  };

  for (const language of Object.values(report.languages)) {
    summary.nodes += language.summary.nodes;
    summary.edges += language.summary.edges;
    summary.cycles += language.summary.cycles;
    summary.cycleNodes += language.summary.cycleNodes;
    summary.maxFanIn = busier(summary.maxFanIn, language.summary.maxFanIn);
    summary.maxFanOut = busier(summary.maxFanOut, language.summary.maxFanOut);
  }

  return summary;
}

/** The busier of two ranked nodes; ties go to the id, as the plugins rank. */
function busier<T extends { id: string; count: number }>(
  a: T | null,
  b: T | null,
): T | null {
  if (!a || !b) return a ?? b;
  if (b.count > a.count) return b;
  return b.count === a.count && b.id < a.id ? b : a;
}
