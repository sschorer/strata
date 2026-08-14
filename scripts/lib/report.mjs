// Render an AnalysisReport for the terminal.

/** Print the whole report: hotspots, coupling, commits, cache, per-language graphs. */
export function printReport(report, target) {
  console.log(`\nStrata — ${target} @ ${report.rev.slice(0, 8)}\n`);
  printHotspots(report);
  printCoupling(report);
  printCommits(report);
  printCache(report);
  printLanguages(report);
}

function printHotspots(report, limit = 15) {
  const hot = report.metrics.find((m) => m.id === 'hotspots');
  console.log('Top hotspots (churn × complexity):');
  for (const p of (hot?.points ?? []).slice(0, limit)) {
    console.log(
      `  ${String(p.value).padStart(7)}  ${p.subject}  ` +
        `(churn ${p.meta?.churn}, cx ${p.meta?.complexity})`,
    );
  }
}

function printCoupling(report, limit = 15) {
  const coupled = report.metrics.find((m) => m.id === 'change-coupling');
  if (!coupled) return;
  console.log('\nTop change coupling (files that change together):');
  for (const p of coupled.points.slice(0, limit)) {
    console.log(
      `  ${`${p.value}%`.padStart(7)}  ${p.subject}  ` +
        `(${p.meta?.sharedChanges} shared of ${p.meta?.changesA}/${p.meta?.changesB})`,
    );
  }
}

function printCommits(report) {
  const valid = report.commits.filter((c) => c.valid).length;
  const breaking = report.commits.filter((c) => c.breaking).length;
  console.log(
    `\nCommits: ${report.commits.length} analysed, ${valid} conventional, ` +
      `${breaking} breaking`,
  );
}

function printCache({ cache }) {
  console.log(
    cache.enabled
      ? `\nCache: ${cache.hits} file hits / ${cache.misses} computed, ` +
          `${cache.runHits} plugin runs skipped (${cache.path})`
      : '\nCache: disabled',
  );
}

function printLanguages(report, cycleLimit = 5) {
  for (const [langs, a] of Object.entries(report.languages)) {
    console.log(
      `\nLanguage [${langs}]: ${a.graph.nodes.length} files, ` +
        `${a.graph.edges.length} imports, ${a.graph.cycles.length} cycles`,
    );
    for (const cyc of a.graph.cycles.slice(0, cycleLimit)) {
      console.log(`  cycle: ${cyc.join(' → ')}`);
    }
    printDeadCode(a);
  }
}

function printDeadCode(analysis, limit = 15) {
  if (analysis.deadCode.length === 0) return;
  const counts = new Map();
  for (const f of analysis.deadCode) {
    counts.set(f.reason, (counts.get(f.reason) ?? 0) + 1);
  }
  const summary = [...counts].map(([r, n]) => `${n} ${r}`).join(', ');
  console.log(`  dead code: ${summary}`);

  for (const f of analysis.deadCode.slice(0, limit)) {
    const where = f.line ? `${f.path}:${f.line}` : f.path;
    console.log(`    ${where}${f.symbol ? `  ${f.symbol}` : ''}  (${f.reason})`);
  }
  if (analysis.deadCode.length > limit) {
    console.log(`    … ${analysis.deadCode.length - limit} more`);
  }
}
