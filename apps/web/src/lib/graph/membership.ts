import type { GraphCycle } from '@strata/sdk';

/**
 * `node id → cycle number`, for the highlight the canvas paints.
 *
 * The number is the cycle's place in the report's list, counted from one — the
 * same order the side panel prints, so a badge on a node and a row in the list
 * mean each other.
 */
export function cycleMembership(
  cycles: readonly GraphCycle[],
): Map<string, number> {
  const membership = new Map<string, number>();
  cycles.forEach((cycle, position) => {
    for (const node of cycle.nodes) membership.set(node, position + 1);
  });
  return membership;
}
