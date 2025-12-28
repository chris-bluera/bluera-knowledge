import { Command } from 'commander';
import { readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { GlobalOptions } from '../program.js';

// ============================================================================
// Types (subset from tests/scripts/search-quality.types.ts)
// ============================================================================

interface Scores {
  relevance: number;
  ranking: number;
  coverage: number;
  snippetQuality: number;
  overall: number;
}

interface QueryEvaluation {
  timestamp: string;
  query: { id?: string; query: string; intent: string };
  searchResults: Array<{ source: string; snippet: string; score?: number }>;
  evaluation: EvaluationResult;
  searchTimeMs: number;
  evaluationTimeMs?: number;
}

interface RunSummary {
  timestamp: string;
  runId: string;
  config: { querySet: string; searchMode: string };
  totalQueries: number;
  averageScores: Scores;
  topSuggestions: string[];
  totalTimeMs: number;
  hilReview?: {
    humanAverageScore: number;
    aiVsHumanDelta: number;
    queriesReviewed: number;
    synthesis?: string;
  };
}

interface QuerySet {
  version: string;
  description: string;
  queries: Array<{ id: string; query: string; category: string; intent: string }>;
  source?: 'curated' | 'ai-generated';
}

interface ParsedRun {
  runStart: { timestamp: string; runId: string; config: Record<string, unknown> };
  evaluations: QueryEvaluation[];
  summary: RunSummary | null;
}

interface QuerySetInfo {
  name: string;
  path: string;
  queryCount: number;
  source: 'curated' | 'ai-generated';
  version?: string;
}

interface RunInfo {
  id: string;
  path: string;
  querySet: string;
  queryCount: number;
  overallScore: number;
  hasHilReview: boolean;
  timestamp: string;
}

interface QualityConfig {
  queryCount: number;
  searchLimit: number;
  searchMode: 'hybrid' | 'semantic' | 'keyword';
  stores: string[] | null;
  timeoutMs: number;
  querySet: string;
  corpusVersion: string;
}

interface Baseline {
  updatedAt: string;
  corpus: string;
  querySet: string;
  scores: Scores;
  thresholds: {
    regression: number;
    improvement: number;
  };
}

interface EvaluationResult {
  scores: Scores;
  analysis: {
    relevance: string;
    ranking: string;
    coverage: string;
    snippetQuality: string;
  };
  suggestions: string[];
  resultAssessments: Array<{
    rank: number;
    source: string;
    relevant: boolean;
    note?: string;
  }>;
}

interface CoreQuery {
  id: string;
  query: string;
  intent: string;
  taskContext?: string;
  category: 'implementation' | 'debugging' | 'understanding' | 'decision' | 'pattern';
}

type HilJudgment = 'good' | 'okay' | 'poor' | 'terrible';

const HIL_JUDGMENT_SCORES: Record<HilJudgment, number> = {
  good: 1.0,
  okay: 0.7,
  poor: 0.4,
  terrible: 0.1,
};

interface HilQueryData {
  reviewed: boolean;
  judgment?: HilJudgment;
  humanScore?: number;
  note?: string;
  flagged?: boolean;
  reviewedAt?: string;
}

interface HilReviewSummary {
  reviewedAt: string;
  queriesReviewed: number;
  queriesSkipped: number;
  queriesFlagged: number;
  humanAverageScore: number;
  aiVsHumanDelta: number;
  synthesis: string;
  actionItems: string[];
}

// ============================================================================
// Box-drawing table utilities
// ============================================================================

const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
};

const BAR = {
  filled: '█',
  empty: '░',
};

interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

interface TableConfig {
  title?: string;
  columns: Column[];
}

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 3) + '...';
}

function pad(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const truncated = truncate(str, width);
  const padding = width - truncated.length;
  if (padding <= 0) return truncated;

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + truncated;
    case 'center': {
      const left = Math.floor(padding / 2);
      return ' '.repeat(left) + truncated + ' '.repeat(padding - left);
    }
    default:
      return truncated + ' '.repeat(padding);
  }
}

function drawLine(widths: number[], left: string, mid: string, right: string): string {
  const segments = widths.map(w => BOX.horizontal.repeat(w + 2));
  return left + segments.join(mid) + right;
}

function drawRow(cells: string[], widths: number[], aligns: ('left' | 'right' | 'center')[]): string {
  const padded = cells.map((cell, i) => pad(cell, widths[i] ?? 10, aligns[i] ?? 'left'));
  return BOX.vertical + ' ' + padded.join(' ' + BOX.vertical + ' ') + ' ' + BOX.vertical;
}

function drawTable(config: TableConfig, rows: string[][]): string {
  const widths = config.columns.map(c => c.width);
  const aligns = config.columns.map(c => c.align || 'left');
  const headers = config.columns.map(c => c.header);

  const lines: string[] = [];

  if (config.title !== undefined && config.title !== '') {
    const totalWidth = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 3 + 4;
    lines.push(drawLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));
    lines.push(BOX.vertical + ' ' + pad(config.title, totalWidth - 4, 'left') + ' ' + BOX.vertical);
    lines.push(drawLine(widths, BOX.leftT, BOX.cross, BOX.rightT));
  } else {
    lines.push(drawLine(widths, BOX.topLeft, BOX.topT, BOX.topRight));
  }

  lines.push(drawRow(headers, widths, aligns));
  lines.push(drawLine(widths, BOX.leftT, BOX.cross, BOX.rightT));

  for (const row of rows) {
    lines.push(drawRow(row, widths, aligns));
  }

  lines.push(drawLine(widths, BOX.bottomLeft, BOX.bottomT, BOX.bottomRight));

  return lines.join('\n');
}

function drawBox(title: string, lines: string[], width: number): string {
  const output: string[] = [];

  output.push(BOX.topLeft + BOX.horizontal.repeat(width - 2) + BOX.topRight);
  output.push(BOX.vertical + ' ' + pad(title, width - 4) + ' ' + BOX.vertical);
  output.push(BOX.leftT + BOX.horizontal.repeat(width - 2) + BOX.rightT);

  for (const line of lines) {
    output.push(BOX.vertical + ' ' + pad(line, width - 4) + ' ' + BOX.vertical);
  }

  output.push(BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight);

  return output.join('\n');
}

function drawBar(value: number, max: number = 1, width: number = 40): string {
  const ratio = Math.min(Math.max(value / max, 0), 1);
  const filled = Math.round(ratio * width);
  return BAR.filled.repeat(filled) + BAR.empty.repeat(width - filled);
}

function formatScore(score: number, decimals: number = 2): string {
  return score.toFixed(decimals);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${String(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${String(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes)}m${String(remaining)}s`;
}

function getTrend(current: number, previous: number): string {
  const delta = current - previous;
  if (Math.abs(delta) < 0.005) return '  —';
  const sign = delta > 0 ? '▲' : '▼';
  return `${sign} ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
}

function shortPath(fullPath: string, maxLen: number = 20): string {
  const match = fullPath.match(/corpus\/(.+)/);
  if (match !== null && match[1] !== undefined && match[1] !== '') {
    return truncate(match[1], maxLen);
  }
  const parts = fullPath.split('/');
  return truncate(parts[parts.length - 1] ?? fullPath, maxLen);
}

// ============================================================================
// Path helpers - find test directories from project root
// ============================================================================

function getProjectRoot(): string {
  // Start from cwd and look for package.json
  let dir = process.cwd();
  while (dir !== '/') {
    if (existsSync(join(dir, 'package.json'))) {
      return dir;
    }
    dir = join(dir, '..');
  }
  return process.cwd();
}

function getResultsDir(): string {
  return join(getProjectRoot(), 'tests', 'quality-results');
}

function getQueriesDir(): string {
  return join(getProjectRoot(), 'tests', 'fixtures', 'queries');
}

function getCorpusDir(): string {
  return join(getProjectRoot(), 'tests', 'fixtures', 'corpus');
}

function getSchemasDir(): string {
  return join(getProjectRoot(), 'tests', 'scripts', 'schemas');
}

// ============================================================================
// Shell and Claude CLI Helpers
// ============================================================================

const STORE_NAME = 'bluera-test-corpus';
const CLAUDE_CLI = process.env['CLAUDE_CLI'] ?? `${process.env['HOME'] ?? ''}/.claude/local/claude`;

function runCommand(command: string, options: { cwd: string; timeout: number; maxBuffer?: number }): string {
  const execOptions: ExecSyncOptionsWithStringEncoding = {
    encoding: 'utf-8',
    cwd: options.cwd,
    timeout: options.timeout,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    shell: '/bin/sh',
  };
  return execSync(command, execOptions);
}

function shellEscape(str: string): string {
  return `'${str.replace(/'/g, "'\"'\"'")}'`;
}

function parseClaudeOutput(output: string): unknown {
  if (output === '' || output.trim() === '') {
    throw new Error('Claude CLI returned empty output');
  }

  let wrapper;
  try {
    wrapper = JSON.parse(output) as {
      result: string;
      is_error: boolean;
      structured_output?: unknown;
    };
  } catch (e) {
    console.error('Failed to parse Claude CLI wrapper. Raw output (first 500 chars):', output.slice(0, 500));
    throw e;
  }

  if (wrapper.is_error) {
    throw new Error(`Claude CLI error: ${wrapper.result}`);
  }

  if (wrapper.structured_output !== undefined) {
    return wrapper.structured_output;
  }

  let result = wrapper.result;
  const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch !== null && codeBlockMatch[1] !== undefined && codeBlockMatch[1] !== '') {
    result = codeBlockMatch[1].trim();
  } else {
    const jsonObjectMatch = result.match(/(\{[\s\S]*\})/);
    const jsonArrayMatch = result.match(/(\[[\s\S]*\])/);
    if (jsonObjectMatch !== null && jsonObjectMatch[1] !== undefined) {
      result = jsonObjectMatch[1];
    } else if (jsonArrayMatch !== null && jsonArrayMatch[1] !== undefined) {
      result = jsonArrayMatch[1];
    }
  }

  try {
    return JSON.parse(result) as unknown;
  } catch (e) {
    console.error('Failed to parse result as JSON. Result (first 1000 chars):', result.slice(0, 1000));
    throw e;
  }
}

function validateClaudeEnvironment(): void {
  if (!existsSync(CLAUDE_CLI)) {
    throw new Error(`Claude CLI not found at ${CLAUDE_CLI}. Set CLAUDE_CLI env var to the correct path.`);
  }
  try {
    runCommand(`${CLAUDE_CLI} --version`, { cwd: getProjectRoot(), timeout: 10000 });
  } catch (error) {
    throw new Error(`Claude CLI at ${CLAUDE_CLI} is not working: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function createPrompt(): { question: (q: string) => Promise<string>; close: () => void } {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return {
    question: (q: string): Promise<string> => new Promise<string>(resolve => { rl.question(q, resolve); }),
    close: (): void => { rl.close(); },
  };
}

function formatJudgmentPrompt(): string {
  return '[g]ood  [o]kay  [p]oor  [t]errible  [n]ote only  [enter] skip';
}

function parseJudgment(input: string): HilJudgment | 'note' | 'skip' {
  const lower = input.toLowerCase().trim();
  if (lower === '' || lower === 's') return 'skip';
  if (lower === 'g' || lower === 'good') return 'good';
  if (lower === 'o' || lower === 'okay') return 'okay';
  if (lower === 'p' || lower === 'poor') return 'poor';
  if (lower === 't' || lower === 'terrible') return 'terrible';
  if (lower === 'n' || lower === 'note') return 'note';
  return 'skip';
}

// ============================================================================
// Config and Schema Loading
// ============================================================================

function loadConfig(): QualityConfig {
  const configPath = join(getProjectRoot(), 'tests', 'quality-config.json');
  const defaultConfig: QualityConfig = {
    queryCount: 15,
    searchLimit: 10,
    searchMode: 'hybrid',
    stores: null,
    timeoutMs: 120000,
    querySet: 'core',
    corpusVersion: '1.0.0',
  };

  if (existsSync(configPath)) {
    const userConfig = JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<QualityConfig>;
    return { ...defaultConfig, ...userConfig };
  }
  return defaultConfig;
}

function loadSchema(name: string): string {
  return readFileSync(join(getSchemasDir(), `${name}.json`), 'utf-8');
}

function loadBaseline(): Baseline | null {
  const baselinePath = join(getResultsDir(), 'baseline.json');
  if (!existsSync(baselinePath)) {
    return null;
  }
  return JSON.parse(readFileSync(baselinePath, 'utf-8')) as Baseline;
}

function saveBaseline(scores: Scores, config: QualityConfig): void {
  const baselinePath = join(getResultsDir(), 'baseline.json');
  const querySetData = loadQuerySet(config.querySet);
  const baseline: Baseline = {
    updatedAt: new Date().toISOString().split('T')[0] ?? '',
    corpus: config.corpusVersion,
    querySet: `${config.querySet}@${querySetData.version}`,
    scores,
    thresholds: {
      regression: 0.05,
      improvement: 0.03,
    },
  };
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline saved to ${baselinePath}`);
}

function loadAllQuerySets(): QuerySet {
  const sets = listQuerySets().filter(s => s.source === 'curated');
  const combined: QuerySet = {
    version: '1.0.0',
    description: 'Combined curated query sets',
    queries: [],
    source: 'curated',
  };

  for (const set of sets) {
    const data = JSON.parse(readFileSync(set.path, 'utf-8')) as QuerySet;
    combined.queries.push(...data.queries.map(q => ({
      ...q,
      id: `${set.name}:${q.id}`,
    })));
  }

  return combined;
}

// ============================================================================
// Data Loading Helpers
// ============================================================================

interface RunFileLine {
  type: string;
  timestamp?: string;
  runId?: string;
  config?: Record<string, unknown>;
  data?: unknown;
}

function parseRunFile(path: string): ParsedRun {
  const content = readFileSync(path, 'utf-8');
  const lines = content.trim().split('\n').map(l => JSON.parse(l) as RunFileLine);

  const evaluations: QueryEvaluation[] = [];
  let summary: RunSummary | null = null;
  let runStart: ParsedRun['runStart'] = { timestamp: '', runId: '', config: {} };

  for (const line of lines) {
    if (line.type === 'run_start') {
      runStart = { timestamp: line.timestamp ?? '', runId: line.runId ?? '', config: line.config ?? {} };
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

function listQuerySets(): QuerySetInfo[] {
  const sets: QuerySetInfo[] = [];
  const queriesDir = getQueriesDir();

  // Curated sets (top-level .json files)
  if (existsSync(queriesDir)) {
    const files = readdirSync(queriesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(queriesDir, file);
        const data = JSON.parse(readFileSync(path, 'utf-8')) as QuerySet;
        sets.push({
          name: basename(file, '.json'),
          path,
          queryCount: data.queries.length,
          source: data.source ?? 'curated',
          version: data.version,
        });
      }
    }
  }

  // Generated sets (in generated/ subdirectory)
  const generatedDir = join(queriesDir, 'generated');
  if (existsSync(generatedDir)) {
    const files = readdirSync(generatedDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const path = join(generatedDir, file);
        const data = JSON.parse(readFileSync(path, 'utf-8')) as QuerySet;
        sets.push({
          name: `generated/${basename(file, '.json')}`,
          path,
          queryCount: data.queries.length,
          source: 'ai-generated',
          version: data.version,
        });
      }
    }
  }

  return sets;
}

function loadQuerySet(name: string): QuerySet {
  const sets = listQuerySets();
  const set = sets.find(s => s.name === name);
  if (!set) {
    throw new Error(`Query set not found: ${name}`);
  }
  return JSON.parse(readFileSync(set.path, 'utf-8')) as QuerySet;
}

function listRuns(): RunInfo[] {
  const runs: RunInfo[] = [];
  const resultsDir = getResultsDir();

  if (!existsSync(resultsDir)) return runs;

  const files = readdirSync(resultsDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort()
    .reverse();

  for (const file of files) {
    const path = join(resultsDir, file);
    const lines = readFileSync(path, 'utf-8').trim().split('\n');

    for (const line of lines) {
      const parsed = JSON.parse(line) as RunFileLine;
      if (parsed.type === 'run_summary' && parsed.data !== undefined) {
        const data = parsed.data as RunSummary;
        runs.push({
          id: basename(file, '.jsonl'),
          path,
          querySet: data.config.querySet,
          queryCount: data.totalQueries,
          overallScore: data.averageScores.overall,
          hasHilReview: data.hilReview !== undefined,
          timestamp: data.timestamp,
        });
        break;
      }
    }
  }

  return runs;
}

// ============================================================================
// Display Commands
// ============================================================================

function showCorpus(): void {
  const corpusDir = getCorpusDir();
  const versionPath = join(corpusDir, 'VERSION.md');
  let version = 'unknown';
  let updated = 'unknown';

  if (existsSync(versionPath)) {
    const content = readFileSync(versionPath, 'utf-8');
    const versionMatch = content.match(/Current Version:\s*(\S+)/);
    const updatedMatch = content.match(/Last Updated\s*\n(\d{4}-\d{2}-\d{2})/);
    if (versionMatch !== null && versionMatch[1] !== undefined && versionMatch[1] !== '') version = versionMatch[1];
    if (updatedMatch !== null && updatedMatch[1] !== undefined && updatedMatch[1] !== '') updated = updatedMatch[1];
  }

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
    const path = join(corpusDir, dir.name);
    const count = countFilesRecursive(path);
    totalFiles += count;
    rows.push([dir.name, `${String(count)} files`, dir.desc]);
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

  console.log(`\n  Total: ${String(totalFiles)} files indexed\n`);
}

function showQueries(verbose: boolean = false): void {
  const sets = listQuerySets();

  if (sets.length === 0) {
    console.log('\n  No query sets found.\n');
    return;
  }

  if (!verbose) {
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

  const baselinePath = join(getResultsDir(), 'baseline.json');
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

  console.log();
  const headerLines = [
    `Overall: ${formatScore(scores.overall)}   Duration: ${formatDuration(summary.totalTimeMs)}   Queries: ${summary.totalQueries}   Query Set: ${config.querySet}`,
  ];

  console.log(drawBox(`Run: ${run.id}`, headerLines, 80));

  console.log();
  console.log('  Scores by Dimension:');
  console.log(`  ${drawBar(scores.relevance, 1, 30)} Relevance      ${formatScore(scores.relevance)}`);
  console.log(`  ${drawBar(scores.ranking, 1, 30)} Ranking        ${formatScore(scores.ranking)}`);
  console.log(`  ${drawBar(scores.coverage, 1, 30)} Coverage       ${formatScore(scores.coverage)}`);
  console.log(`  ${drawBar(scores.snippetQuality, 1, 30)} SnippetQual    ${formatScore(scores.snippetQuality)}`);

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

  if (summary.topSuggestions && summary.topSuggestions.length > 0) {
    console.log('\n  Top Suggestions:');
    summary.topSuggestions.slice(0, 5).forEach((s, i) => {
      console.log(`  ${i + 1}. ${truncate(s, 75)}`);
    });
  }

  const hilReview = summary.hilReview;
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

    const firstRunInfo = runs[0];
    if (firstRunInfo) {
      const parsed = parseRunFile(firstRunInfo.path);
      console.log('  Available queries in latest run:');
      parsed.evaluations.slice(0, 10).forEach(e => {
        console.log(`    ${e.query.id || 'unnamed'}: ${truncate(e.query.query, 50)}`);
      });
    }
    console.log();
    return;
  }

  const matchingRun = runs.find(r => r.id === queryData[0]?.runId);
  if (!matchingRun) {
    console.log(`\n  Could not find run data.\n`);
    return;
  }
  const firstRun = parseRunFile(matchingRun.path);
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

  const firstEntry = trendData[trendData.length - 1];
  const lastEntry = trendData[0];
  if (trendData.length >= 2 && firstEntry && lastEntry) {
    const first = firstEntry.scores.overall;
    const last = lastEntry.scores.overall;
    const delta = last - first;
    const pct = ((delta / first) * 100).toFixed(1);

    console.log();
    console.log(`  Overall trend: ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} (${delta >= 0 ? '+' : ''}${pct}%) over ${trendData.length} runs`);
  }

  console.log();
}

// ============================================================================
// Action Commands
// ============================================================================

async function doIndex(): Promise<void> {
  console.log('\n🔧 Corpus Index Setup');
  console.log(`   Store: ${STORE_NAME}`);
  console.log(`   Corpus: ${getCorpusDir()}`);

  const corpusDir = getCorpusDir();
  if (!existsSync(corpusDir)) {
    console.error(`❌ Corpus directory not found: ${corpusDir}`);
    process.exit(1);
  }

  const projectRoot = getProjectRoot();

  // Check if store exists, delete if so
  try {
    execSync(`node dist/index.js store info ${STORE_NAME}`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    console.log(`\n⚠️  Store "${STORE_NAME}" exists, deleting...`);
    console.log('\n📌 Deleting existing store...');
    execSync(`node dist/index.js store delete ${STORE_NAME} --force`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } catch {
    // Store doesn't exist, that's fine
  }

  // Create store
  console.log('\n📌 Creating test store...');
  execSync(
    `node dist/index.js store create ${STORE_NAME} --type file --source "${corpusDir}" --description "Test corpus for search quality benchmarks"`,
    { cwd: projectRoot, stdio: 'inherit' }
  );

  // Index the store
  console.log('\n📌 Indexing corpus...');
  execSync(`node dist/index.js index ${STORE_NAME}`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // Show store info
  console.log('\n📌 Verifying store...');
  execSync(`node dist/index.js store info ${STORE_NAME}`, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  console.log('\n✅ Corpus indexed successfully!');
  console.log(`   Run quality tests with: ./dist/index.js quality test`);
}

interface SearchResult {
  rank: number;
  score: number;
  source: string;
  content: string;
}

function runSearch(query: string, config: QualityConfig): { results: SearchResult[]; timeMs: number } {
  const startTime = Date.now();
  const args = [
    'node', 'dist/index.js', 'search',
    JSON.stringify(query),
    '--mode', config.searchMode,
    '--limit', String(config.searchLimit),
    '--include-content',
  ];

  if (config.stores && config.stores.length > 0) {
    args.push('--stores', config.stores.join(','));
  }

  const rawOutput = runCommand(args.join(' '), {
    cwd: getProjectRoot(),
    timeout: config.timeoutMs,
  });

  const results: SearchResult[] = [];
  const lines = rawOutput.split('\n');
  let currentResult: Partial<SearchResult> | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(\d+)\.\s+\[(-?[0-9.]+)\]\s+(.+)$/);
    if (headerMatch && headerMatch[1] && headerMatch[2] && headerMatch[3]) {
      if (currentResult && currentResult.content !== undefined) {
        results.push(currentResult as SearchResult);
      }
      currentResult = {
        rank: parseInt(headerMatch[1], 10),
        score: parseFloat(headerMatch[2]),
        source: headerMatch[3].trim(),
        content: '',
      };
    } else if (currentResult && line.startsWith('   ')) {
      currentResult.content += (currentResult.content ? '\n' : '') + line.trim();
    }
  }
  if (currentResult && currentResult.content !== undefined) {
    results.push(currentResult as SearchResult);
  }

  return { results, timeMs: Date.now() - startTime };
}

function evaluateResults(
  query: string,
  intent: string,
  results: SearchResult[],
  config: QualityConfig
): { evaluation: EvaluationResult; timeMs: number } {
  const startTime = Date.now();
  const schema = loadSchema('evaluation');

  const resultsForPrompt = results.map(r => ({
    rank: r.rank,
    score: r.score,
    source: r.source,
    contentPreview: r.content.slice(0, 500) + (r.content.length > 500 ? '...' : ''),
  }));

  const prompt = `You are evaluating search results for an AI coding assistant. The assistant queried a knowledge base to help complete a coding task.

**Coding Task Query:** "${query}"
**What the agent is trying to do:** ${intent}

**Search Results Returned (${results.length}):**
${JSON.stringify(resultsForPrompt, null, 2)}

Evaluate whether these results would help an agent COMPLETE THE CODING TASK (0.0 to 1.0 scale):

1. **Relevance**: Would these results help solve the problem? (Not just "related to the topic" but actually actionable)
2. **Ranking**: Is the MOST ACTIONABLE result ranked first? Does the top result show HOW to solve the problem?
3. **Coverage**: Does the agent have all the information needed to complete the task? Any critical pieces missing?
4. **Snippet Quality**: Do the previews show code examples or clear instructions? (Not just topic mentions)
5. **Overall**: If you were the agent, could you complete the task with these results?

Key distinction:
- HIGH score = "These results show me exactly how to solve this"
- LOW score = "These results mention the topic but don't help me actually do it"

Provide:
- Numeric scores for each dimension
- Analysis focused on task completion potential
- Suggestions for improving search to return more actionable results
- Assessment of each result: would it help complete the task? (with notes)

Be critical. A result that just mentions "Vue reactivity" is not helpful if it doesn't show HOW to use ref().`;

  const normalizedSchema = JSON.stringify(JSON.parse(schema));
  const args = [
    CLAUDE_CLI,
    '-p', shellEscape(prompt),
    '--output-format', 'json',
    '--json-schema', shellEscape(normalizedSchema),
  ];

  const result = runCommand(args.join(' '), {
    cwd: getProjectRoot(),
    timeout: config.timeoutMs,
  });

  return {
    evaluation: parseClaudeOutput(result) as EvaluationResult,
    timeMs: Date.now() - startTime,
  };
}

function calculateAverageScores(evaluations: QueryEvaluation[]): Scores {
  const avgScores: Scores = {
    relevance: 0,
    ranking: 0,
    coverage: 0,
    snippetQuality: 0,
    overall: 0,
  };

  for (const eval_ of evaluations) {
    avgScores.relevance += eval_.evaluation.scores.relevance;
    avgScores.ranking += eval_.evaluation.scores.ranking;
    avgScores.coverage += eval_.evaluation.scores.coverage;
    avgScores.snippetQuality += eval_.evaluation.scores.snippetQuality;
    avgScores.overall += eval_.evaluation.scores.overall;
  }

  const count = evaluations.length || 1;
  avgScores.relevance = Math.round((avgScores.relevance / count) * 100) / 100;
  avgScores.ranking = Math.round((avgScores.ranking / count) * 100) / 100;
  avgScores.coverage = Math.round((avgScores.coverage / count) * 100) / 100;
  avgScores.snippetQuality = Math.round((avgScores.snippetQuality / count) * 100) / 100;
  avgScores.overall = Math.round((avgScores.overall / count) * 100) / 100;

  return avgScores;
}

function extractTopSuggestions(evaluations: QueryEvaluation[]): string[] {
  const suggestionCounts = new Map<string, number>();
  for (const eval_ of evaluations) {
    for (const suggestion of eval_.evaluation.suggestions) {
      const key = suggestion.toLowerCase().slice(0, 100);
      suggestionCounts.set(key, (suggestionCounts.get(key) || 0) + 1);
    }
  }

  return [...suggestionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);
}

interface QueryGenerationResult {
  queries: Array<{ query: string; intent: string }>;
}

function generateQueriesFromCorpus(config: QualityConfig): QueryGenerationResult {
  console.log('🔍 Generating test queries from tests/fixtures/...');

  const schema = loadSchema('query-generation');
  const prompt = `You have access to explore the tests/fixtures/ directory which contains content that has been indexed in a knowledge store search system.

Your task:
1. Use the Glob and Read tools to explore tests/fixtures/ and understand what content is available
2. Generate exactly ${config.queryCount} diverse search queries that would thoroughly test the search system

Generate queries that:
- Cover different content types (code, documentation, READMEs)
- Range from specific (function names) to conceptual (design patterns)
- Include some ambiguous queries that could match multiple files
- Test edge cases (very short queries, natural language questions)

Return your queries in the specified JSON format.`;

  const normalizedSchema = JSON.stringify(JSON.parse(schema));
  const args = [
    CLAUDE_CLI,
    '-p', shellEscape(prompt),
    '--output-format', 'json',
    '--json-schema', shellEscape(normalizedSchema),
    '--allowedTools', 'Glob,Read',
  ];

  const result = runCommand(args.join(' '), {
    cwd: getProjectRoot(),
    timeout: config.timeoutMs * 2,
  });

  const parsed = parseClaudeOutput(result) as QueryGenerationResult;
  console.log(`✓ Generated ${String(parsed.queries.length)} queries\n`);
  return parsed;
}

async function doTest(options: {
  explore?: boolean;
  set?: string;
  quiet?: boolean;
  updateBaseline?: boolean;
}): Promise<void> {
  validateClaudeEnvironment();

  const startTime = Date.now();
  const config = loadConfig();
  const runId = Math.random().toString(36).substring(2, 10);
  const querySetName = options.set || (options.explore ? 'explore' : config.querySet);

  console.log('🚀 AI Search Quality Testing');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Query set: ${querySetName}`);
  console.log(`   Search mode: ${config.searchMode}`);
  console.log(`   Stores: ${config.stores?.join(', ') || 'all'}\n`);

  const baseline = loadBaseline();
  if (baseline) {
    console.log(`📊 Baseline: ${baseline.querySet} (${baseline.updatedAt})`);
    console.log(`   Overall: ${baseline.scores.overall}\n`);
  }

  const resultsDir = getResultsDir();
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = join(resultsDir, `${timestamp}.jsonl`);

  appendFileSync(outputPath, JSON.stringify({
    type: 'run_start',
    timestamp: new Date().toISOString(),
    runId,
    config: { ...config, querySet: querySetName },
  }) + '\n');

  let queries: Array<{ id?: string; query: string; intent: string }>;

  if (options.explore) {
    console.log('🔍 Generating exploratory queries...');
    const generated = generateQueriesFromCorpus(config);
    queries = generated.queries;

    const generatedDir = join(getQueriesDir(), 'generated');
    if (!existsSync(generatedDir)) {
      mkdirSync(generatedDir, { recursive: true });
    }
    const generatedPath = join(generatedDir, `${timestamp}.json`);
    const generatedSet: QuerySet = {
      version: '1.0.0',
      description: `AI-generated queries from ${timestamp}`,
      queries: queries.map((q, i) => ({
        id: `gen-${i + 1}`,
        query: q.query,
        intent: q.intent,
        category: 'implementation' as const,
      })),
      source: 'ai-generated',
    };
    writeFileSync(generatedPath, JSON.stringify(generatedSet, null, 2));
    console.log(`   Saved to: ${generatedPath}\n`);
  } else {
    let querySet: QuerySet;
    if (querySetName === 'all') {
      querySet = loadAllQuerySets();
      console.log(`📋 Loaded ${querySet.queries.length} queries from all curated sets\n`);
    } else {
      querySet = loadQuerySet(querySetName);
      console.log(`📋 Loaded ${querySet.queries.length} queries from ${querySetName}.json\n`);
    }
    queries = querySet.queries.map(q => ({ id: q.id, query: q.query, intent: q.intent }));
  }

  console.log('📊 Evaluating search quality...');
  const evaluations: QueryEvaluation[] = [];

  for (const q of queries) {
    const progress = `[${evaluations.length + 1}/${queries.length}]`;

    const { results, timeMs: searchTimeMs } = runSearch(q.query, config);
    const { evaluation, timeMs: evaluationTimeMs } = evaluateResults(
      q.query,
      q.intent,
      results,
      config
    );

    const record: QueryEvaluation = {
      timestamp: new Date().toISOString(),
      query: q,
      searchResults: results.map(r => ({
        source: r.source,
        snippet: r.content.slice(0, 200),
        score: r.score,
      })),
      evaluation,
      searchTimeMs,
      evaluationTimeMs,
    };

    evaluations.push(record);
    appendFileSync(outputPath, JSON.stringify({ type: 'query_evaluation', data: record }) + '\n');

    if (options.quiet) {
      console.log(`  ${progress} "${q.query.slice(0, 40)}${q.query.length > 40 ? '...' : ''}" - overall: ${evaluation.scores.overall.toFixed(2)}`);
    } else {
      console.log(`\n${progress} "${q.query}"`);
      for (const r of results.slice(0, 5)) {
        console.log(`  → ${r.rank}. [${r.score.toFixed(2)}] ${r.source}`);
        const snippet = r.content.slice(0, 100).replace(/\n/g, ' ');
        console.log(`       "${snippet}${r.content.length > 100 ? '...' : ''}"`);
      }
      if (results.length > 5) {
        console.log(`  ... and ${results.length - 5} more results`);
      }
      const s = evaluation.scores;
      console.log(`  ✓ AI: relevance=${s.relevance.toFixed(2)} ranking=${s.ranking.toFixed(2)} coverage=${s.coverage.toFixed(2)} snippet=${s.snippetQuality.toFixed(2)} overall=${s.overall.toFixed(2)}`);
    }
  }

  const summary: RunSummary = {
    timestamp: new Date().toISOString(),
    runId,
    config: { querySet: querySetName, searchMode: config.searchMode },
    totalQueries: queries.length,
    averageScores: calculateAverageScores(evaluations),
    topSuggestions: extractTopSuggestions(evaluations),
    totalTimeMs: Date.now() - startTime,
  };

  appendFileSync(outputPath, JSON.stringify({ type: 'run_summary', data: summary }) + '\n');

  console.log(`\n✓ Results written to ${outputPath}`);
  console.log(`📈 Average overall score: ${summary.averageScores.overall}`);
  console.log(`⏱️  Total time: ${(summary.totalTimeMs / 1000).toFixed(1)}s`);

  if (summary.topSuggestions.length > 0) {
    console.log('\n🎯 Top suggestions for improvement:');
    summary.topSuggestions.forEach((suggestion, i) => console.log(`   ${i + 1}. ${suggestion}`));
  }

  if (baseline && !options.explore) {
    console.log('\n📊 Comparison to Baseline:');
    const dims = ['relevance', 'ranking', 'coverage', 'snippetQuality', 'overall'] as const;

    for (const dim of dims) {
      const current = summary.averageScores[dim];
      const base = baseline.scores[dim];
      const diff = current - base;
      const diffStr = diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
      const indicator = diff < -baseline.thresholds.regression ? '❌' :
                       diff > baseline.thresholds.improvement ? '✅' : '  ';
      console.log(`   ${dim.padEnd(15)} ${current.toFixed(2)}  (${diffStr}) ${indicator}`);
    }

    const hasRegression = dims.some(d =>
      summary.averageScores[d] - baseline.scores[d] < -baseline.thresholds.regression
    );

    if (hasRegression) {
      console.log('\n⚠️  REGRESSION DETECTED - scores dropped below threshold');
    } else {
      console.log('\n✅ No regressions detected');
    }
  }

  if (options.updateBaseline) {
    saveBaseline(summary.averageScores, config);
  }

  const dimensions = ['relevance', 'ranking', 'coverage', 'snippetQuality'] as const;
  const lowestDim = dimensions.reduce((min, dim) =>
    summary.averageScores[dim] < summary.averageScores[min] ? dim : min
  );
  console.log(`\n💡 Recommended focus: ${lowestDim} (avg: ${summary.averageScores[lowestDim]})`);
}

async function doBaseline(): Promise<void> {
  const runs = listRuns();
  const latest = runs[0];
  if (!latest) {
    console.log('\n  No test runs found. Run `quality test` first.\n');
    return;
  }

  const parsed = parseRunFile(latest.path);

  if (!parsed.summary) {
    console.log(`\n  Run ${latest.id} has no summary data.\n`);
    return;
  }

  const config = loadConfig();
  saveBaseline(parsed.summary.averageScores, config);
}

async function doGenerate(options: { seed?: string }): Promise<void> {
  validateClaudeEnvironment();

  const prompt = createPrompt();
  console.log('🔍 Query Generation Mode\n');

  let seedQueries: CoreQuery[] = [];
  if (options.seed) {
    const seed = options.seed === 'all' ? loadAllQuerySets() : loadQuerySet(options.seed);
    seedQueries = seed.queries as CoreQuery[];
    console.log(`Seeding from ${options.seed} (${seedQueries.length} queries)\n`);
  }

  console.log('Generating queries from corpus analysis...\n');

  const generatePrompt = `You have access to explore the tests/fixtures/ directory which contains content indexed in a knowledge store.

${seedQueries.length > 0 ? `Existing queries to build on:\n${seedQueries.map(q => `- "${q.query}" (${q.category})`).join('\n')}\n\nPropose 10-15 NEW queries that complement the existing ones.` : 'Propose 10-15 diverse search queries.'}

For each query provide:
- query: the search string
- intent: what the user is trying to find
- category: one of implementation, debugging, understanding, decision, pattern

Return as JSON array.`;

  const args = [
    CLAUDE_CLI,
    '-p', shellEscape(generatePrompt),
    '--output-format', 'json',
    '--allowedTools', 'Glob,Read',
  ];

  let result: string;
  try {
    result = runCommand(args.join(' '), {
      cwd: getProjectRoot(),
      timeout: 120000,
    });
  } catch (error: unknown) {
    const execError = error as { killed?: boolean; signal?: string; message?: string };
    if (execError.killed && execError.signal === 'SIGTERM') {
      console.error('Error: Claude CLI call timed out after 120 seconds');
    } else {
      console.error(`Error calling Claude CLI: ${execError.message || String(error)}`);
    }
    throw error;
  }

  let queries: CoreQuery[];
  try {
    const parsed = parseClaudeOutput(result) as CoreQuery[];
    queries = parsed;
  } catch (error: unknown) {
    const parseError = error as { message?: string };
    console.error('Error: Failed to parse Claude CLI response');
    console.error(`Response was: ${result.substring(0, 500)}...`);
    throw new Error(`Invalid response from Claude CLI: ${parseError.message || String(error)}`);
  }

  queries = queries.map((q, i) => ({
    ...q,
    id: `gen-${String(i + 1).padStart(3, '0')}`,
  }));

  let done = false;
  while (!done) {
    console.log(`\nProposed queries (${queries.length}):\n`);
    queries.forEach((q, i) => {
      console.log(`${String(i + 1).padStart(2)}. [${q.category}] "${q.query}"`);
      console.log(`    Intent: ${q.intent}\n`);
    });

    const action = await prompt.question('Actions: [a]ccept, [d]rop <nums>, [e]dit <num>, [q]uit: ');

    if (action === 'a' || action === 'accept') {
      done = true;
    } else if (action.startsWith('d ') || action.startsWith('drop ')) {
      const nums = action.replace(/^d(rop)?\s+/, '').split(',').map(n => parseInt(n.trim(), 10) - 1);
      queries = queries.filter((_, i) => !nums.includes(i));
      console.log(`Dropped ${nums.length} queries.`);
    } else if (action.startsWith('e ') || action.startsWith('edit ')) {
      const num = parseInt(action.replace(/^e(dit)?\s+/, ''), 10) - 1;
      if (queries[num]) {
        const newQuery = await prompt.question(`Query [${queries[num].query}]: `);
        const newIntent = await prompt.question(`Intent [${queries[num].intent}]: `);
        if (newQuery.trim()) queries[num].query = newQuery.trim();
        if (newIntent.trim()) queries[num].intent = newIntent.trim();
      }
    } else if (action === 'q' || action === 'quit') {
      prompt.close();
      console.log('Cancelled.');
      return;
    }
  }

  const name = await prompt.question('Save as (name): ');
  const filename = name.trim() || `generated-${new Date().toISOString().split('T')[0]}`;

  const outputDir = join(getQueriesDir(), 'generated');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = join(outputDir, `${filename}.json`);
  const querySet: QuerySet = {
    version: '1.0.0',
    description: `AI-generated queries from ${new Date().toISOString()}`,
    queries,
    source: 'ai-generated',
  };

  writeFileSync(outputPath, JSON.stringify(querySet, null, 2));
  console.log(`\n✓ Saved ${queries.length} queries to ${outputPath}`);

  prompt.close();
}

async function doReview(options: { runId?: string | undefined; list?: boolean | undefined }): Promise<void> {
  const runs = listRuns();

  if (options.list || !options.runId) {
    showRuns();
    if (!options.runId) {
      console.log('Usage: quality review <run-id>');
    }
    return;
  }

  const run = runs.find(r => r.id === options.runId || r.id.includes(options.runId!));
  if (!run) {
    console.error(`Run not found: ${options.runId}`);
    console.log('\nAvailable runs:');
    runs.slice(0, 5).forEach(r => console.log(`    ${r.id}`));
    return;
  }

  validateClaudeEnvironment();

  const prompt = createPrompt();
  const parsed = parseRunFile(run.path);

  console.log(`\n📊 Reviewing run: ${run.id}`);
  console.log(`   ${parsed.evaluations.length} queries, overall=${run.overallScore.toFixed(2)}\n`);

  const hilData: Map<number, HilQueryData> = new Map();

  for (let i = 0; i < parsed.evaluations.length; i++) {
    const eval_ = parsed.evaluations[i];
    if (!eval_) continue;

    const progress = `[${i + 1}/${parsed.evaluations.length}]`;

    console.log(`\n${progress} "${eval_.query.query}"`);
    console.log(`  AI overall: ${eval_.evaluation.scores.overall.toFixed(2)}`);
    console.log(`\n  Results returned:`);

    for (const r of eval_.searchResults.slice(0, 5)) {
      const shortSourcePath = r.source.replace(/.*\/tests\/fixtures\/corpus\//, '');
      console.log(`  → ${shortSourcePath}`);
      const snippet = r.snippet.slice(0, 200).replace(/\n/g, ' ');
      console.log(`       "${snippet}${r.snippet.length > 200 ? '...' : ''}"`);
    }

    console.log(`\n  How did the search do?`);
    console.log(`  ${formatJudgmentPrompt()}`);

    const input = await prompt.question('> ');
    const judgment = parseJudgment(input);

    if (judgment === 'skip') {
      hilData.set(i, { reviewed: false });
      continue;
    }

    const hil: HilQueryData = {
      reviewed: true,
      reviewedAt: new Date().toISOString(),
    };

    if (judgment !== 'note') {
      hil.judgment = judgment;
      hil.humanScore = HIL_JUDGMENT_SCORES[judgment];
    }

    const note = await prompt.question('  Note (optional): ');
    if (note.trim()) {
      hil.note = note.trim();
    }

    hilData.set(i, hil);
  }

  prompt.close();

  const reviewed = [...hilData.values()].filter(h => h.reviewed);
  const scores = reviewed.filter(h => h.humanScore !== undefined).map(h => h.humanScore!);
  const humanAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const flagged = reviewed.filter(h => h.flagged).length;

  console.log('\n📝 Generating synthesis...');

  const synthesisPrompt = `Summarize this human review of search quality results:

AI average score: ${run.overallScore.toFixed(2)}
Human average score: ${humanAvg.toFixed(2)}
Queries reviewed: ${reviewed.length}/${parsed.evaluations.length}

Human judgments:
${[...hilData.entries()].filter(([_, h]) => h.reviewed).map(([i, h]) => {
  const evalItem = parsed.evaluations[i];
  const q = evalItem?.query.query ?? 'unknown';
  return `- "${q}": ${h.judgment ?? 'note only'}${h.note ? ` - "${h.note}"` : ''}`;
}).join('\n')}

Provide:
1. A 2-3 sentence synthesis of the human feedback
2. 2-4 specific action items for improving search quality

Return as JSON: { "synthesis": "...", "actionItems": ["...", "..."] }`;

  const result = runCommand([
    CLAUDE_CLI,
    '-p', shellEscape(synthesisPrompt),
    '--output-format', 'json',
  ].join(' '), {
    cwd: getProjectRoot(),
    timeout: 60000,
  });

  const synthResult = JSON.parse(result) as { result?: string; structured_output?: { synthesis: string; actionItems: string[] } };
  const content = synthResult.result || '';

  const jsonMatch = content.match(/\{[\s\S]*"synthesis"[\s\S]*"actionItems"[\s\S]*\}/);
  if (!jsonMatch && !synthResult.structured_output) {
    throw new Error(`Claude CLI did not return valid JSON. Response: ${content.slice(0, 200)}`);
  }

  const synthesis = synthResult.structured_output ?? JSON.parse(jsonMatch![0]) as { synthesis: string; actionItems: string[] };

  const hilReview: HilReviewSummary = {
    reviewedAt: new Date().toISOString(),
    queriesReviewed: reviewed.length,
    queriesSkipped: parsed.evaluations.length - reviewed.length,
    queriesFlagged: flagged,
    humanAverageScore: Math.round(humanAvg * 100) / 100,
    aiVsHumanDelta: Math.round((humanAvg - run.overallScore) * 100) / 100,
    synthesis: synthesis.synthesis,
    actionItems: synthesis.actionItems,
  };

  // Read original file and update with HIL data
  const originalContent = readFileSync(run.path, 'utf-8');
  const originalLines = originalContent.trim().split('\n').map(l => JSON.parse(l));

  let evalIdx = 0;
  const updatedLines = originalLines.map(line => {
    if (line.type === 'query_evaluation') {
      const hil = hilData.get(evalIdx);
      evalIdx++;
      if (hil) {
        return { ...line, data: { ...line.data, hil } };
      }
    }
    if (line.type === 'run_summary') {
      return { ...line, data: { ...line.data, hilReview } };
    }
    return line;
  });

  writeFileSync(run.path, updatedLines.map(l => JSON.stringify(l)).join('\n') + '\n');

  console.log(`\n✓ Review saved to ${run.path}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Human avg: ${humanAvg.toFixed(2)} (AI: ${run.overallScore.toFixed(2)}, delta: ${hilReview.aiVsHumanDelta >= 0 ? '+' : ''}${hilReview.aiVsHumanDelta.toFixed(2)})`);
  console.log(`   ${hilReview.synthesis}`);
  console.log(`\n🎯 Action items:`);
  hilReview.actionItems.forEach((item, i) => console.log(`   ${i + 1}. ${item}`));
}

// ============================================================================
// Auto-Improve
// ============================================================================

import {
  AutoImproveOrchestrator,
  ProductionQualityRunner,
  ProductionAgentRunner,
  type ScoreDimension,
} from '../../services/auto-improve/index.js';

async function doAutoImprove(options: {
  run?: string;
  maxIterations?: string;
  targetScore?: string;
  minImprovement?: string;
  rollbackThreshold?: string;
  dryRun?: boolean;
  focus?: string;
}): Promise<void> {
  validateClaudeEnvironment();

  const projectRoot = getProjectRoot();
  const resultsDir = getResultsDir();
  const checkpointDir = join(resultsDir, '.checkpoints');

  console.log('\n🤖 Auto-Improve Mode');
  console.log('   Spawning AI agents to analyze and improve search quality...\n');

  const maxIterations = parseInt(options.maxIterations ?? '3', 10);
  const targetScore = parseFloat(options.targetScore ?? '0.7');
  const minImprovement = parseFloat(options.minImprovement ?? '0.02');
  const rollbackThreshold = parseFloat(options.rollbackThreshold ?? '0.01');
  const focus = options.focus ?? 'auto';

  console.log(`   Max iterations: ${String(maxIterations)}`);
  console.log(`   Target score: ${targetScore.toFixed(2)}`);
  console.log(`   Min improvement: ${minImprovement.toFixed(3)}`);
  console.log(`   Rollback threshold: ${rollbackThreshold.toFixed(3)}`);
  console.log(`   Focus: ${focus}`);
  if (options.dryRun === true) {
    console.log('   Mode: DRY RUN (no changes will be applied)');
  }
  console.log('');

  const qualityRunner = new ProductionQualityRunner(resultsDir, projectRoot);
  const agentRunner = new ProductionAgentRunner(projectRoot);

  const orchestrator = new AutoImproveOrchestrator({
    projectRoot,
    checkpointDir,
    resultsDir,
    qualityRunner,
    agentRunner,
  });

  try {
    const runOptions: import('../../services/auto-improve/index.js').AutoImproveOptions = {
      maxIterations,
      targetScore,
      minImprovement,
      rollbackThreshold,
      dryRun: options.dryRun === true,
      focus: focus === 'auto' ? 'auto' : focus as ScoreDimension,
    };
    if (options.run !== undefined) {
      runOptions.runId = options.run;
    }
    const result = await orchestrator.run(runOptions);

    console.log('\n' + '═'.repeat(60));
    console.log('📊 Auto-Improve Results');
    console.log('═'.repeat(60));

    console.log(`\n   Iterations: ${String(result.iterations.length)}`);
    console.log(`   Changes applied: ${String(result.changesApplied)}`);
    console.log(`   Total improvement: ${result.totalImprovement >= 0 ? '+' : ''}${result.totalImprovement.toFixed(3)}`);

    console.log('\n   Final Scores:');
    console.log(`     Relevance:      ${result.finalScores.relevance.toFixed(3)}`);
    console.log(`     Ranking:        ${result.finalScores.ranking.toFixed(3)}`);
    console.log(`     Coverage:       ${result.finalScores.coverage.toFixed(3)}`);
    console.log(`     Snippet Quality: ${result.finalScores.snippetQuality.toFixed(3)}`);
    console.log(`     Overall:        ${result.finalScores.overall.toFixed(3)}`);

    console.log(`\n   Status: ${result.message}`);

    if (result.iterations.length > 0) {
      console.log('\n   Iteration Details:');
      for (const iter of result.iterations) {
        const status = iter.rolledBack ? '❌ ROLLED BACK' : '✅';
        console.log(`     ${String(iter.iteration)}. ${status} (improvement: ${iter.improvement >= 0 ? '+' : ''}${iter.improvement.toFixed(3)})`);
        if (iter.reason !== undefined) {
          console.log(`        ${iter.reason}`);
        }
        if (iter.appliedChanges.length > 0) {
          const isDryRun = iter.checkpointId === 'dry-run';
          const changeLabel = isDryRun ? 'Proposed changes' : 'Applied changes';
          console.log(`        ${changeLabel}:`);
          for (const change of iter.appliedChanges) {
            const fileBasename = change.file.split('/').pop() ?? change.file;
            console.log(`          [${change.type}] ${fileBasename}: ${change.description}`);
            if (isDryRun) {
              // Show before/after in dry-run for review
              const beforePreview = change.before.length > 60 ? change.before.slice(0, 60) + '...' : change.before;
              const afterPreview = change.after.length > 60 ? change.after.slice(0, 60) + '...' : change.after;
              console.log(`            Before: ${beforePreview.replace(/\n/g, '\\n')}`);
              console.log(`            After:  ${afterPreview.replace(/\n/g, '\\n')}`);
            }
          }
        }
        // Show agent recommendations summary
        if (iter.recommendations.length > 0) {
          console.log(`        Agent recommendations: ${iter.recommendations.length}`);
          for (const rec of iter.recommendations) {
            console.log(`          - ${rec.agentId}: confidence=${rec.confidence.toFixed(2)}, target=${rec.targetDimension}, expected=+${rec.expectedImprovement.toFixed(3)}`);
            console.log(`            ${rec.reasoning.slice(0, 100)}${rec.reasoning.length > 100 ? '...' : ''}`);
          }
        }
      }
    }

    console.log('');

    if (result.success) {
      console.log('✅ Auto-improve completed successfully!');
    } else {
      console.log('⚠️  Auto-improve completed with issues.');
    }
  } catch (error) {
    console.error('❌ Auto-improve failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// ============================================================================
// Command Factory
// ============================================================================

export function createQualityCommand(_getOptions: () => GlobalOptions): Command {
  const quality = new Command('quality')
    .description('Test and measure search quality using Claude-evaluated queries');

  quality
    .command('corpus')
    .description('Show test corpus: Vue/Express/Hono repos + docs in tests/fixtures/corpus/')
    .action(() => {
      showCorpus();
    });

  quality
    .command('queries')
    .description('List query sets (.json files in tests/fixtures/queries/)')
    .option('--verbose', 'Print each query\'s full text and intent')
    .action((options: { verbose?: boolean }) => {
      showQueries(options.verbose);
    });

  quality
    .command('runs')
    .description('List test runs (tests/quality-results/) with scores')
    .action(() => {
      showRuns();
    });

  quality
    .command('run <id>')
    .description('Show run details: per-query scores, AI analysis, top result sources')
    .action((id: string) => {
      showRunDetail(id);
    });

  quality
    .command('query <id>')
    .description('Track one query across runs: see if ranking improvements helped')
    .action((id: string) => {
      showQueryPerformance(id);
    });

  quality
    .command('trends')
    .description('Compare overall scores across runs (▲ up, ▼ down, — unchanged)')
    .option('-l, --limit <count>', 'Number of recent runs to include (default: 10)', '10')
    .action((options: { limit?: string }) => {
      showTrends(parseInt(options.limit || '10', 10));
    });

  // Action commands
  quality
    .command('reindex')
    .description('Delete bluera-test-corpus store, recreate from tests/fixtures/corpus/')
    .action(async () => {
      await doIndex();
    });

  quality
    .command('test')
    .description('Run queries, search corpus, have Claude score results 0-1 per dimension')
    .option('--explore', 'Generate queries on-the-fly instead of using saved query set')
    .option('--set <name>', 'Query set file from tests/fixtures/queries/ (default: core)')
    .option('--quiet', 'One line per query; skip printing all search results')
    .option('--update-baseline', 'Save scores to baseline.json after run finishes')
    .action(async (options: { explore?: boolean; set?: string; quiet?: boolean; updateBaseline?: boolean }) => {
      await doTest(options);
    });

  quality
    .command('baseline')
    .description('Save latest run to tests/quality-results/baseline.json')
    .action(async () => {
      await doBaseline();
    });

  quality
    .command('generate')
    .description('Claude explores corpus files, proposes queries; you accept/edit/drop')
    .option('--seed <name>', 'Start with existing queries, ask Claude to add more')
    .action(async (options: { seed?: string }) => {
      await doGenerate(options);
    });

  quality
    .command('review [run-id]')
    .description('Rate each query\'s results (good/okay/poor/terrible) to calibrate AI')
    .option('--list', 'Just show available runs, don\'t start reviewing')
    .action(async (runId: string | undefined, options: { list?: boolean }) => {
      await doReview({ runId, list: options.list });
    });

  quality
    .command('auto-improve')
    .description('Spawn AI agents to analyze scores and apply improvements automatically')
    .option('--run <id>', 'Quality run ID to analyze (default: latest)')
    .option('--max-iterations <n>', 'Maximum improvement cycles (default: 3)', '3')
    .option('--target-score <score>', 'Stop when overall score reaches this (default: 0.7)', '0.7')
    .option('--min-improvement <delta>', 'Min improvement per iteration to continue (default: 0.02)', '0.02')
    .option('--rollback-threshold <delta>', 'Rollback if score drops by this much (default: 0.03)', '0.03')
    .option('--dry-run', 'Show proposed changes without applying them')
    .option('--focus <dimension>', 'Focus on: relevance, ranking, coverage, snippetQuality, auto (default: auto)', 'auto')
    .action(async (options: {
      run?: string;
      maxIterations?: string;
      targetScore?: string;
      minImprovement?: string;
      rollbackThreshold?: string;
      dryRun?: boolean;
      focus?: string;
    }) => {
      await doAutoImprove(options);
    });

  return quality;
}
