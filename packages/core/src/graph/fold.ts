import { orderedCycles, summariseGraph, type DependencyGraph } from '@strata/sdk';
import { mergedGraph } from './merge.js';
import { packageNodes } from './packages.js';
import type { CrossLanguageGraph } from './types.js';

/**
 * The cross-language graph a report carries.
 *
 * Everything derived from more than one language's output is folded here, once,
 * rather than by each consumer: a screen, a CI gate and anyone reading the API
 * from another language would otherwise each merge the graphs, each count them
 * and each arrange the cycles — and three folds are eventually three answers
 * (`docs/adr/0010`).
 *
 * The summary describes the merged graph *before* the packages are named, so it
 * counts what the run analysed rather than what it depends on; the graph itself
 * carries them, because the far end of an import is part of the picture.
 */
export function crossLanguageGraph(
  graphs: readonly DependencyGraph[],
): CrossLanguageGraph {
  const merged = mergedGraph(graphs);

  return {
    nodes: [...merged.nodes, ...packageNodes(merged)],
    edges: merged.edges,
    cycles: orderedCycles(merged),
    summary: summariseGraph(merged),
  };
}
