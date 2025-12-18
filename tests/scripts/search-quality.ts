#!/usr/bin/env npx tsx

import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync, appendFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listQuerySets, loadAllQuerySets } from './quality-shared.js';
import type {
  QualityConfig,
  QueryGenerationResult,
  EvaluationResult,
  QueryEvaluation,
  RunSummary,
  Scores,
  QuerySet,
  CoreQuery,
  Baseline,
} from './search-quality.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper to run shell commands with proper typing
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

// Parse Claude CLI JSON output - extracts structured_output when using --json-schema
function parseClaudeOutput<T>(output: string): T {
  if (!output || output.trim() === '') {
    throw new Error('Claude CLI returned empty output');
  }

  let wrapper;
  try {
    wrapper = JSON.parse(output) as {
      result: string;
      is_error: boolean;
      structured_output?: T;
    };
  } catch (e) {
    console.error('Failed to parse Claude CLI wrapper. Raw output (first 500 chars):', output.slice(0, 500));
    throw e;
  }

  if (wrapper.is_error) {
    throw new Error(`Claude CLI error: ${wrapper.result}`);
  }

  // When using --json-schema, the structured output is in a separate field
  if (wrapper.structured_output !== undefined) {
    return wrapper.structured_output;
  }

  // Fallback: try to parse from result field
  let result = wrapper.result;

  // Try to extract JSON from markdown code blocks first
  const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    result = codeBlockMatch[1].trim();
  } else {
    // Try to find a JSON object or array anywhere in the text
    const jsonObjectMatch = result.match(/(\{[\s\S]*\})/);
    const jsonArrayMatch = result.match(/(\[[\s\S]*\])/);

    if (jsonObjectMatch) {
      result = jsonObjectMatch[1];
    } else if (jsonArrayMatch) {
      result = jsonArrayMatch[1];
    }
  }

  try {
    return JSON.parse(result) as T;
  } catch (e) {
    console.error('Failed to parse result as JSON. Result (first 1000 chars):', result.slice(0, 1000));
    throw e;
  }
}

// Escape a string for use as a single-quoted shell argument
function shellEscape(str: string): string {
  // Wrap in single quotes, escape any single quotes inside
  return `'${str.replace(/'/g, "'\"'\"'")}'`;
}
const ROOT_DIR = join(__dirname, '..', '..');
const RESULTS_DIR = join(__dirname, '..', 'quality-results');
const SCHEMAS_DIR = join(__dirname, 'schemas');
const QUERIES_DIR = join(__dirname, '..', 'fixtures', 'queries');
const BASELINE_PATH = join(__dirname, '..', 'quality-results', 'baseline.json');

// Claude CLI path - can be overridden via CLAUDE_CLI env var
const CLAUDE_CLI = process.env.CLAUDE_CLI || `${process.env.HOME}/.claude/local/claude`;

/**
 * Validate that the environment is properly configured before running tests.
 * Throws immediately if Claude CLI is not available or not working.
 */
function validateEnvironment(): void {
  if (!existsSync(CLAUDE_CLI)) {
    throw new Error(`Claude CLI not found at ${CLAUDE_CLI}. Set CLAUDE_CLI env var to the correct path.`);
  }

  // Verify it's executable by running --version
  try {
    runCommand(`${CLAUDE_CLI} --version`, { cwd: ROOT_DIR, timeout: 10000 });
  } catch (error) {
    throw new Error(`Claude CLI at ${CLAUDE_CLI} is not working: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadConfig(): QualityConfig {
  const configPath = join(__dirname, '..', 'quality-config.json');
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
    const userConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
    return { ...defaultConfig, ...userConfig };
  }
  return defaultConfig;
}

function loadSchema(name: string): string {
  return readFileSync(join(SCHEMAS_DIR, `${name}.json`), 'utf-8');
}

function loadQuerySet(name: string): QuerySet {
  if (name === 'explore') {
    throw new Error('Use generateQueries() for explore mode');
  }

  const queryPath = join(QUERIES_DIR, `${name}.json`);
  if (!existsSync(queryPath)) {
    throw new Error(`Query set not found: ${queryPath}`);
  }

  return JSON.parse(readFileSync(queryPath, 'utf-8')) as QuerySet;
}

function loadBaseline(): Baseline | null {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf-8')) as Baseline;
}

function saveBaseline(scores: Scores, config: QualityConfig): void {
  const querySetVersion = config.querySet === 'all'
    ? loadAllQuerySets().version
    : loadQuerySet(config.querySet).version;
  const baseline: Baseline = {
    updatedAt: new Date().toISOString().split('T')[0],
    corpus: config.corpusVersion,
    querySet: `${config.querySet}@${querySetVersion}`,
    scores,
    thresholds: {
      regression: 0.05,
      improvement: 0.03,
    },
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\n✅ Baseline saved to ${BASELINE_PATH}`);
}

function generateQueries(config: QualityConfig): QueryGenerationResult {
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

  // Normalize schema (remove whitespace)
  const normalizedSchema = JSON.stringify(JSON.parse(schema));
  const args = [
    CLAUDE_CLI,
    '-p', shellEscape(prompt),
    '--output-format', 'json',
    '--json-schema', shellEscape(normalizedSchema),
    '--allowedTools', 'Glob,Read',
  ];

  try {
    const result = runCommand(args.join(' '), {
      cwd: ROOT_DIR,
      timeout: config.timeoutMs * 2, // Extra time for exploration
    });

    const parsed = parseClaudeOutput<QueryGenerationResult>(result);
    console.log(`✓ Generated ${parsed.queries.length} queries\n`);
    return parsed;
  } catch (error) {
    console.error('Failed to generate queries:', error);
    throw error;
  }
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
    cwd: ROOT_DIR,
    timeout: config.timeoutMs,
  });

  // Parse the output format: "1. [-0.23] /path/to/file.ts\n   content..."
  const results: SearchResult[] = [];
  const lines = rawOutput.split('\n');
  let currentResult: Partial<SearchResult> | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^(\d+)\.\s+\[(-?[0-9.]+)\]\s+(.+)$/);
    if (headerMatch) {
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
    cwd: ROOT_DIR,
    timeout: config.timeoutMs,
  });

  return {
    evaluation: parseClaudeOutput<EvaluationResult>(result),
    timeMs: Date.now() - startTime,
  };
}

function generateRunId(): string {
  return Math.random().toString(36).substring(2, 10);
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
  // Collect all suggestions and count occurrences
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

async function main() {
  // Validate environment before doing anything else
  validateEnvironment();

  const startTime = Date.now();
  const config = loadConfig();
  const runId = generateRunId();

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const isExplore = args.includes('--explore');
  const updateBaseline = args.includes('--update-baseline');

  // Output verbosity
  const quietMode = args.includes('--quiet');
  const silentMode = args.includes('--silent');
  const setArg = args.find(a => a.startsWith('--set='));
  const querySetName = setArg ? setArg.split('=')[1] : (isExplore ? 'explore' : config.querySet);

  console.log('🚀 AI Search Quality Testing');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Query set: ${querySetName}`);
  console.log(`   Search mode: ${config.searchMode}`);
  console.log(`   Stores: ${config.stores?.join(', ') || 'all'}\n`);

  // Load baseline for comparison
  const baseline = loadBaseline();
  if (baseline) {
    console.log(`📊 Baseline: ${baseline.querySet} (${baseline.updatedAt})`);
    console.log(`   Overall: ${baseline.scores.overall}\n`);
  }

  // Ensure results directory exists
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  // Generate output filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = join(RESULTS_DIR, `${timestamp}.jsonl`);

  // Write run start marker
  appendFileSync(outputPath, JSON.stringify({
    type: 'run_start',
    timestamp: new Date().toISOString(),
    runId,
    config,
  }) + '\n');

  // Get queries - either from file or generate
  let queries: Array<{ query: string; intent: string }>;

  if (isExplore) {
    console.log('🔍 Generating exploratory queries...');
    const generated = generateQueries(config);
    queries = generated.queries;

    // Save generated queries
    const generatedDir = join(QUERIES_DIR, 'generated');
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
      generatedAt: new Date().toISOString(),
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
    queries = querySet.queries.map(q => ({ query: q.query, intent: q.intent }));
  }

  // Phase 2: Evaluate each query
  console.log('📊 Evaluating search quality...');
  const evaluations: QueryEvaluation[] = [];

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const progress = `[${i + 1}/${queries.length}]`;

    // Run search
    const { results, timeMs: searchTimeMs } = runSearch(q.query, config);

    // Evaluate results
    const { evaluation, timeMs: evaluationTimeMs } = evaluateResults(
      q.query,
      q.intent,
      results,
      config
    );

    // Build full evaluation record
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

    // Write immediately (append)
    appendFileSync(outputPath, JSON.stringify({ type: 'query_evaluation', data: record }) + '\n');

    if (!silentMode) {
      if (quietMode) {
        // Quiet mode: summary only
        console.log(`  ${progress} "${q.query.slice(0, 40)}${q.query.length > 40 ? '...' : ''}" - overall: ${evaluation.scores.overall.toFixed(2)}`);
      } else {
        // Default verbose mode: full results
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
  }

  // Generate and write summary
  const summary: RunSummary = {
    timestamp: new Date().toISOString(),
    runId,
    config,
    totalQueries: queries.length,
    successfulQueries: evaluations.filter(e => e.evaluation.scores.overall > 0).length,
    failedQueries: evaluations.filter(e => e.evaluation.scores.overall === 0).length,
    averageScores: calculateAverageScores(evaluations),
    queryEvaluations: evaluations,
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

  // Compare to baseline
  if (baseline && !isExplore) {
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

  // Update baseline if requested
  if (updateBaseline) {
    saveBaseline(summary.averageScores, config);
  }

  // Find lowest scoring dimension for focus recommendation
  const dimensions = ['relevance', 'ranking', 'coverage', 'snippetQuality'] as const;
  const lowestDim = dimensions.reduce((min, dim) =>
    summary.averageScores[dim] < summary.averageScores[min] ? dim : min
  );

  console.log(`\n💡 Recommended focus: ${lowestDim} (avg: ${summary.averageScores[lowestDim]})`);
}

main().catch(console.error);
