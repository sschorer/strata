// Render an AnalysisReport for the terminal.

/** Print the whole report: hotspots, commits, cache, per-language graphs. */
export function printReport(report, target) {
  console.log(`\nStrata — ${target} @ ${report.rev.slice(0, 8)}\n`);
  printHotspots(report);
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
  }
}
