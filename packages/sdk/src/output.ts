import type { ParsedCommit } from './commit.js';
import type { Finding } from './finding.js';
import type { DependencyGraph } from './graph.js';
import type { MetricSeries } from './metric.js';

/**
 * Every output type, as a value — a registry validating a hand-written manifest
 * needs the list at runtime, not just the type.
 */
export const OUTPUT_TYPES = [
  'graph',
  'metrics',
  'findings',
  'commits',
  'aggregate',
] as const;

/**
 * What a stage produces, and what another stage asks for when it declares what
 * it consumes.
 *
 * The set is **closed** and lives here, even though the set of stages is open:
 * a stage depends on an output type, never on another stage's id, so adding a
 * language module feeds every stage that consumes a graph with no configuration
 * anywhere. Adding an output type is an SDK change; adding a stage is not
 * (`docs/adr/0010`).
 */
export type OutputType = (typeof OUTPUT_TYPES)[number];

/**
 * Whatever a stage folded for itself: the commit fold's counts per type and
 * scope, a rule engine's tally per rule.
 *
 * The escape hatch a closed set needs — a stage whose result is none of the
 * other four stays a stage instead of becoming an SDK change. Its shape is the
 * producer's own: the core carries it, serialises it and never reads inside it,
 * and only a consumer that means one specific producer narrows it. It must
 * therefore be JSON, because it crosses the wire like everything else in a
 * report.
 */
export type Aggregate = unknown;

/**
 * The shape behind each output type: what a stage producing it hands over, and
 * what a stage consuming it receives.
 *
 * One table rather than a convention, so "consumes a graph" means the same
 * thing to the producer, the consumer, the cache and the screen.
 */
export interface StageOutputs {
  /** A dependency graph over files, modules or packages. */
  graph: DependencyGraph;
  /** One measured series — hotspots, change coupling, code age. */
  metrics: MetricSeries;
  /** Everything one stage found, in one list. */
  findings: Finding[];
  /** The analysed history window as a convention parsed it, log order. */
  commits: ParsedCommit[];
  /** Numbers only the producing stage and a consumer that means it understand. */
  aggregate: Aggregate;
}

/** The shape of one output type, spelled the short way. */
export type StageOutput<T extends OutputType = OutputType> = StageOutputs[T];
