#!/usr/bin/env npx tsx

/**
 * Quality Results Display CLI
 *
 * Commands:
 *   corpus      Show corpus/fixtures info
 *   queries     Show query sets with details
 *   runs        Show test runs (overview)
 *   run <id>    Show detailed run results
 *   query <id>  Show specific query performance across runs
 *   trends      Show score trends over time
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  listQuerySets,
  loadQuerySet,
  listRuns,
  RESULTS_DIR,
  QUERIES_DIR,
} from './quality-shared.js';
import {
  drawTable,
  drawBox,
  drawBar,
  formatScore,
  formatDuration,
  formatDate,
  getTrend,
  shortPath,
  truncate,
} from './quality-table.js';
import type { QueryEvaluation, RunSummary, Scores } from './search-quality.types.js';

const CORPUS_DIR = join(import.meta.dirname, '..', 'fixtures', 'corpus');

// ============================================================================
// Data Loading Helpers
// ============================================================================

interface ParsedRun {
  runStart: { timestamp: string; runId: string; config: Record<string, unknown> };
  evaluations: QueryEvaluation[];
  summary: RunSummary | null;
}

function parseRunFile(path: string): ParsedRun {
  const content = readFileSync(path, 'utf-8');
  const lines = content.trim().split('\n').map(l => JSON.parse(l));

  const evaluations: QueryEvaluation[] = [];
  let summary: RunSummary | null = null;
  let runStart: ParsedRun['runStart'] = { timestamp: '', runId: '', config: {} };

  for (const line of lines) {
    if (line.type === 'run_start') {
      runStart = { timestamp: line.timestamp, runId: line.runId, config: line.config };
    } else if (line.type === 'query_evaluation') {
      evaluations.push(line.data as QueryEvaluation);
    } else if (line.type === 'run_summary') {
      summary = line.data as RunSummary;
    }
  }

  return { runStart, evaluations, summary };
}

function countFilesRecursive(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFilesRecursive(join(dir, entry.name));
    } else if (!entry.name.startsWith('.')) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Commands
// ============================================================================

function showCorpus(): void {
  // Parse VERSION.md for metadata
  const versionPath = join(CORPUS_DIR, 'VERSION.md');
  let version = 'unknown';
  let updated = 'unknown';

  if (existsSync(versionPath)) {
    const content = readFileSync(versionPath, 'utf-8');
    const versionMatch = content.match(/Current Version:\s*(\S+)/);
    const updatedMatch = content.match(/Last Updated\s*\n(\d{4}-\d{2}-\d{2})/);
    if (versionMatch) version = versionMatch[1];
    if (updatedMatch) updated = updatedMatch[1];
  }

  // Count files in each directory
  const directories = [
    { name: 'oss-repos/vue', desc: 'Vue.js core (full repo)' },
    { name: 'oss-repos/express', desc: 'Express.js (full repo)' },
    { name: 'oss-repos/hono', desc: 'Hono (full repo)' },
    { name: 'documentation', desc: 'Express/Node excerpts' },
    { name: 'articles', desc: 'React, TypeScript, JWT' },
  ];

  const rows: string[][] = [];
  let totalFiles = 0;

  for (const dir of directories) {
    const path = join(CORPUS_DIR, dir.name);
    const count = countFilesRecursive(path);
    totalFiles += count;
    rows.push([dir.name, `${count} files`, dir.desc]);
  }

  console.log();
  console.log(drawTable({
    title: `Corpus v${version}                             Updated: ${updated}`,
    columns: [
      { header: 'Directory', width: 18 },
      { header: 'Files', width: 10, align: 'right' },
      { header: 'Description', width: 30 },
    ],
  }, rows));

  console.log(`\n  Total: ${totalFiles} files indexed\n`);
}

function showQueries(verbose: boolean = false): void {
  const sets = listQuerySets();

  if (!verbose) {
    // Summary view
    const rows = sets.map(s => [
      s.name,
      String(s.queryCount),
      `${s.source === 'curated' ? 'Curated' : 'AI-generated'} (v${s.version || '?'})`,
    ]);

    console.log();
    console.log(drawTable({
      title: 'Query Sets',
      columns: [
        { header: 'Name', width: 20 },
        { header: 'Count', width: 6, align: 'right' },
        { header: 'Source', width: 35 },
      ],
    }, rows));

    // Show category breakdown for curated sets
    for (const set of sets.filter(s => s.source === 'curated')) {
      const data = loadQuerySet(set.name);
      const categories: Record<string, number> = {};
      for (const q of data.queries) {
        categories[q.category] = (categories[q.category] || 0) + 1;
      }

      const breakdown = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ');

      console.log(`\n  ${set.name} categories: ${breakdown}`);
    }
    console.log();
  } else {
    // Detailed view with all queries
    for (const set of sets) {
      const data = loadQuerySet(set.name);

      const rows = data.queries.map(q => [
        q.id,
        q.category,
        truncate(q.query, 50),
      ]);

      console.log();
      console.log(drawTable({
        title: `${set.name} (${data.queries.length} queries)`,
        columns: [
          { header: 'ID', width: 12 },
          { header: 'Category', width: 14 },
          { header: 'Query', width: 50 },
        ],
      }, rows));
    }
    console.log();
  }
}

function showRuns(): void {
  const runs = listRuns();

  if (runs.length === 0) {
    console.log('\n  No test runs found.\n');
    return;
  }

  const rows = runs.slice(0, 15).map(r => {
    // Load full run to get all scores
    const parsed = parseRunFile(r.path);
    const scores = parsed.summary?.averageScores;

    const scoreStr = scores
      ? `${formatScore(scores.relevance)}/${formatScore(scores.ranking)}/${formatScore(scores.coverage)}/${formatScore(scores.snippetQuality)}`
      : '—';

    return [
      r.id,
      String(r.queryCount),
      formatScore(r.overallScore),
      scoreStr,
      r.hasHilReview ? '✓ reviewed' : '—',
    ];
  });

  console.log();
  console.log(drawTable({
    title: `Test Runs                                              (${runs.length} total)`,
    columns: [
      { header: 'Run ID', width: 21 },
      { header: 'Queries', width: 7, align: 'right' },
      { header: 'Overall', width: 7, align: 'right' },
      { header: 'Scores (R/Rk/C/S)', width: 20 },
      { header: 'HIL Status', width: 12 },
    ],
  }, rows));

  console.log('\n  Legend: R=Relevance, Rk=Ranking, C=Coverage, S=SnippetQuality');

  // Check for baseline
  const baselinePath = join(RESULTS_DIR, 'baseline.json');
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
    console.log(`  Baseline: ${formatScore(baseline.scores?.overall || 0)} overall (set ${baseline.updatedAt?.slice(0, 10) || 'unknown'})`);
  }
  console.log();
}

function showRunDetail(runId: string): void {
  const runs = listRuns();
  const run = runs.find(r => r.id === runId || r.id.includes(runId));

  if (!run) {
    console.log(`\n  Run not found: ${runId}`);
    console.log('  Available runs:');
    runs.slice(0, 5).forEach(r => console.log(`    ${r.id}`));
    console.log();
    return;
  }

  const parsed = parseRunFile(run.path);
  const summary = parsed.summary;

  if (!summary) {
    console.log(`\n  Run ${run.id} has no summary data.\n`);
    return;
  }

  const scores = summary.averageScores;
  const config = summary.config;

  // Header box
  console.log();
  const headerLines = [
    `Overall: ${formatScore(scores.overall)}   Duration: ${formatDuration(summary.totalTimeMs)}   Queries: ${summary.totalQueries}   Query Set: ${config.querySet}`,
  ];

  console.log(drawBox(`Run: ${run.id}`, headerLines, 80));

  // Score bars
  console.log();
  console.log('  Scores by Dimension:');
  console.log(`  ${drawBar(scores.relevance, 1, 30)} Relevance      ${formatScore(scores.relevance)}`);
  console.log(`  ${drawBar(scores.ranking, 1, 30)} Ranking        ${formatScore(scores.ranking)}`);
  console.log(`  ${drawBar(scores.coverage, 1, 30)} Coverage       ${formatScore(scores.coverage)}`);
  console.log(`  ${drawBar(scores.snippetQuality, 1, 30)} SnippetQual    ${formatScore(scores.snippetQuality)}`);

  // Query results table (sorted by score)
  const sortedEvals = [...parsed.evaluations].sort(
    (a, b) => b.evaluation.scores.overall - a.evaluation.scores.overall
  );

  const rows = sortedEvals.map(e => {
    const topResult = e.searchResults[0];
    return [
      e.query.id || '—',
      formatScore(e.evaluation.scores.overall),
      truncate(e.query.query, 40),
      topResult ? shortPath(topResult.source, 14) : '—',
    ];
  });

  console.log();
  console.log(drawTable({
    title: 'Query Results (sorted by score)',
    columns: [
      { header: 'ID', width: 12 },
      { header: 'Score', width: 6, align: 'right' },
      { header: 'Query', width: 40 },
      { header: 'Top Result', width: 14 },
    ],
  }, rows));

  // Top suggestions
  if (summary.topSuggestions && summary.topSuggestions.length > 0) {
    console.log('\n  Top Suggestions:');
    summary.topSuggestions.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${truncate(s, 75)}`);
    });
  }

  // HIL review summary if present
  const hilReview = (summary as any).hilReview;
  if (hilReview) {
    console.log('\n  HIL Review:');
    console.log(`    Human avg: ${formatScore(hilReview.humanAverageScore)} (AI: ${formatScore(scores.overall)}, delta: ${hilReview.aiVsHumanDelta >= 0 ? '+' : ''}${formatScore(hilReview.aiVsHumanDelta)})`);
    console.log(`    Queries reviewed: ${hilReview.queriesReviewed}/${summary.totalQueries}`);
    if (hilReview.synthesis) {
      console.log(`    Summary: ${truncate(hilReview.synthesis, 70)}`);
    }
  }

  console.log();
}

function showQueryPerformance(queryId: string): void {
  const runs = listRuns();

  if (runs.length === 0) {
    console.log('\n  No test runs found.\n');
    return;
  }

  // Find query across all runs
  const queryData: Array<{
    runId: string;
    timestamp: string;
    scores: Scores;
    topResult: string;
  }> = [];

  for (const run of runs) {
    const parsed = parseRunFile(run.path);
    const evaluation = parsed.evaluations.find(
      e => e.query.id === queryId || (e.query.id && e.query.id.includes(queryId))
    );

    if (evaluation) {
      queryData.push({
        runId: run.id,
        timestamp: run.timestamp,
        scores: evaluation.evaluation.scores,
        topResult: evaluation.searchResults[0]?.source || '—',
      });
    }
  }

  if (queryData.length === 0) {
    console.log(`\n  Query not found: ${queryId}`);

    // Show available query IDs from most recent run
    if (runs.length > 0) {
      const parsed = parseRunFile(runs[0].path);
      console.log('  Available queries in latest run:');
      parsed.evaluations.slice(0, 10).forEach(e => {
        console.log(`    ${e.query.id || 'unnamed'}: ${truncate(e.query.query, 50)}`);
      });
    }
    console.log();
    return;
  }

  // Show query text from first occurrence
  const firstRun = parseRunFile(runs.find(r => r.id === queryData[0].runId)!.path);
  const queryEval = firstRun.evaluations.find(e => e.query.id === queryId || e.query.id?.includes(queryId));
  const queryText = queryEval?.query.query || queryId;

  console.log();
  console.log(`  Query: ${queryId}`);
  console.log(`  "${truncate(queryText, 70)}"`);
  console.log();

  const rows = queryData.map((d, i) => {
    const prev = queryData[i + 1];
    const trend = prev ? getTrend(d.scores.overall, prev.scores.overall) : '—';

    return [
      d.runId.slice(0, 19),
      formatScore(d.scores.overall),
      formatScore(d.scores.relevance),
      formatScore(d.scores.ranking),
      shortPath(d.topResult, 18),
      trend,
    ];
  });

  console.log(drawTable({
    title: `Performance History (${queryData.length} runs)`,
    columns: [
      { header: 'Run', width: 19 },
      { header: 'Overall', width: 7, align: 'right' },
      { header: 'Rel', width: 5, align: 'right' },
      { header: 'Rank', width: 5, align: 'right' },
      { header: 'Top Result', width: 18 },
      { header: 'Trend', width: 8 },
    ],
  }, rows));

  console.log();
}

function showTrends(limit: number = 10): void {
  const runs = listRuns().slice(0, limit);

  if (runs.length < 2) {
    console.log('\n  Need at least 2 runs to show trends.\n');
    return;
  }

  const trendData: Array<{
    runId: string;
    scores: Scores;
  }> = [];

  for (const run of runs) {
    const parsed = parseRunFile(run.path);
    if (parsed.summary) {
      trendData.push({
        runId: run.id,
        scores: parsed.summary.averageScores,
      });
    }
  }

  const rows = trendData.map((d, i) => {
    const prev = trendData[i + 1];
    const trend = prev ? getTrend(d.scores.overall, prev.scores.overall) : 'baseline';

    return [
      d.runId.replace('T', ' ').slice(0, 16),
      formatScore(d.scores.overall),
      formatScore(d.scores.relevance),
      formatScore(d.scores.ranking),
      formatScore(d.scores.coverage),
      trend,
    ];
  });

  console.log();
  console.log(drawTable({
    title: `Score Trends (last ${trendData.length} runs)`,
    columns: [
      { header: 'Date', width: 16 },
      { header: 'Overall', width: 7, align: 'right' },
      { header: 'Rel', width: 5, align: 'right' },
      { header: 'Rank', width: 5, align: 'right' },
      { header: 'Cov', width: 5, align: 'right' },
      { header: 'Trend', width: 10 },
    ],
  }, rows));

  // Calculate overall trend
  if (trendData.length >= 2) {
    const first = trendData[trendData.length - 1].scores.overall;
    const last = trendData[0].scores.overall;
    const delta = last - first;
    const pct = ((delta / first) * 100).toFixed(1);

    console.log();
    console.log(`  Overall trend: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${delta >= 0 ? '+' : ''}${pct}%) over ${trendData.length} runs`);
  }

  console.log();
}

function showHelp(): void {
  console.log(`
Quality Results Display CLI

Usage: npm run test:quality:show -- <command> [options]

Commands:
  corpus              Show corpus/fixtures info
  queries             Show query sets summary
  queries --verbose   Show all queries in detail
  runs                Show test runs overview
  run <id>            Show detailed run results
  query <id>          Show query performance across runs
  trends              Show score trends over time
  trends --limit=N    Show last N runs (default: 10)

Examples:
  npm run test:quality:show -- corpus
  npm run test:quality:show -- runs
  npm run test:quality:show -- run 2025-12-18T10-28-20
  npm run test:quality:show -- query vue-001
  npm run test:quality:show -- trends --limit=5
`);
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse flags
  const verbose = args.includes('--verbose') || args.includes('-v');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

  switch (command) {
    case 'corpus':
      showCorpus();
      break;

    case 'queries':
      showQueries(verbose);
      break;

    case 'runs':
      showRuns();
      break;

    case 'run':
      const runId = args[1];
      if (!runId) {
        console.log('\n  Usage: npm run test:quality:show -- run <run-id>\n');
        showRuns();
      } else {
        showRunDetail(runId);
      }
      break;

    case 'query':
      const queryId = args[1];
      if (!queryId) {
        console.log('\n  Usage: npm run test:quality:show -- query <query-id>\n');
      } else {
        showQueryPerformance(queryId);
      }
      break;

    case 'trends':
      showTrends(limit);
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      if (command) {
        console.log(`\n  Unknown command: ${command}\n`);
      }
      showHelp();
  }
}

main();
