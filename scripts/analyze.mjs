#!/usr/bin/env node
// Analyze a repository from the command line, without starting the server.
//   node scripts/analyze.mjs /path/to/repo [historyLimit]
//
// Imports the built core directly so `make analyze` works after `make build`.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const { PluginRegistry, Strata } = await import(
  resolve(repoRoot, 'packages/core/dist/index.js')
).catch(() => {
  console.error('Build first: `make build` (or `pnpm -r build`).');
  process.exit(1);
});

const target = process.argv[2];
const historyLimit = Number(process.argv[3] ?? 500);
if (!target) {
  console.error('usage: node scripts/analyze.mjs <repo-path> [historyLimit]');
  process.exit(1);
}

const registry = new PluginRegistry();
for (const rel of [
  'plugins/commit-conventional/strata.plugin.json',
  'plugins/git-hotspots/strata.plugin.json',
  'plugins/language-typescript/strata.plugin.json',
]) {
  await registry.loadFrom(resolve(repoRoot, rel));
}

const strata = new Strata(registry);
const report = await strata.analyze({
  root: resolve(target),
  historyLimit,
});
strata.close();

const hot = report.metrics.find((m) => m.id === 'hotspots');
console.log(`\nStrata — ${resolve(target)} @ ${report.rev.slice(0, 8)}\n`);

console.log('Top hotspots (churn × complexity):');
for (const p of (hot?.points ?? []).slice(0, 15)) {
  console.log(
    `  ${String(p.value).padStart(7)}  ${p.subject}  ` +
      `(churn ${p.meta?.churn}, cx ${p.meta?.complexity})`,
  );
}

const valid = report.commits.filter((c) => c.valid).length;
console.log(
  `\nCommits: ${report.commits.length} analysed, ${valid} conventional, ` +
    `${report.commits.filter((c) => c.breaking).length} breaking`,
);

const c = report.cache;
console.log(
  c.enabled
    ? `\nCache: ${c.hits} file hits / ${c.misses} computed, ` +
        `${c.runHits} plugin runs skipped (${c.path})`
    : '\nCache: disabled',
);

for (const [langs, a] of Object.entries(report.languages)) {
  console.log(
    `\nLanguage [${langs}]: ${a.graph.nodes.length} files, ` +
      `${a.graph.edges.length} imports, ${a.graph.cycles.length} cycles`,
  );
  for (const cyc of a.graph.cycles.slice(0, 5)) {
    console.log(`  cycle: ${cyc.join(' → ')}`);
  }
}
