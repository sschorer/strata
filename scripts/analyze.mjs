#!/usr/bin/env node
// Analyze a repository from the command line, without starting the server.
//   node scripts/analyze.mjs /path/to/repo [historyLimit]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtinRegistry, loadCore } from './lib/core.mjs';
import { printReport } from './lib/report.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const target = process.argv[2];
const historyLimit = Number(process.argv[3] ?? 500);
if (!target) {
  console.error('usage: node scripts/analyze.mjs <repo-path> [historyLimit]');
  process.exit(1);
}

const { PluginRegistry, Strata } = await loadCore(repoRoot);
const registry = await builtinRegistry(repoRoot, PluginRegistry);

const strata = new Strata(registry);
let report;
try {
  report = await strata.analyze({ root: resolve(target), historyLimit });
} finally {
  // Flushes pending cache writes even when the analysis threw.
  strata.close();
}

printReport(report, resolve(target));
