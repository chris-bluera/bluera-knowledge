#!/usr/bin/env npx tsx

import { execSync, type ExecSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  QualityConfig,
  QueryGenerationResult,
  EvaluationResult,
  QueryEvaluation,
  RunSummary,
  Scores,
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
const ROOT_DIR = join(__dirname, '..', '..');
const RESULTS_DIR = join(__dirname, '..', 'quality-results');
const SCHEMAS_DIR = join(__dirname, 'schemas');

function loadConfig(): QualityConfig {
  const configPath = join(__dirname, '..', 'quality-config.json');
  const defaultConfig: QualityConfig = {
    queryCount: 15,
    searchLimit: 10,
    searchMode: 'hybrid',
    stores: null,
    maxRetries: 3,
    timeoutMs: 60000,
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

  const schemaArg = JSON.stringify(JSON.parse(schema));
  const args = [
    'claude',
    '-p', JSON.stringify(prompt),
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schemaArg),
    '--allowedTools', 'Glob,Read',
  ];

  try {
    const result = runCommand(args.join(' '), {
      cwd: ROOT_DIR,
      timeout: config.timeoutMs * 2, // Extra time for exploration
    });

    const parsed = JSON.parse(result) as QueryGenerationResult;
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

  try {
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
  } catch (error) {
    console.error(`Search failed for query "${query}":`, error);
    return { results: [], timeMs: Date.now() - startTime };
  }
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

  const prompt = `Evaluate these search results for quality.

**Query:** "${query}"
**Intent:** ${intent}

**Search Results (${results.length} returned):**
${JSON.stringify(resultsForPrompt, null, 2)}

Evaluate on these dimensions (0.0 to 1.0 scale):

1. **Relevance**: Do the results actually relate to the query intent?
2. **Ranking**: Are the most relevant results at the top?
3. **Coverage**: Did the search find the expected content? (Consider what SHOULD match)
4. **Snippet Quality**: Are the content previews useful and showing relevant sections?
5. **Overall**: Weighted assessment of search quality

Provide:
- Numeric scores for each dimension
- Detailed analysis explaining each score
- Specific, actionable suggestions for improving the search system
- Assessment of each result (relevant or not, with notes)

Be critical and specific. Your feedback will be used to improve the search system.`;

  const schemaArg = JSON.stringify(JSON.parse(schema));
  const args = [
    'claude',
    '-p', JSON.stringify(prompt),
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schemaArg),
  ];

  try {
    const result = runCommand(args.join(' '), {
      cwd: ROOT_DIR,
      timeout: config.timeoutMs,
    });

    return {
      evaluation: JSON.parse(result) as EvaluationResult,
      timeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`Evaluation failed for query "${query}":`, error);
    // Return a failure result
    return {
      evaluation: {
        scores: { relevance: 0, ranking: 0, coverage: 0, snippetQuality: 0, overall: 0 },
        analysis: {
          relevance: 'Evaluation failed',
          ranking: 'Evaluation failed',
          coverage: 'Evaluation failed',
          snippetQuality: 'Evaluation failed',
        },
        suggestions: ['Evaluation failed - check logs'],
        resultAssessments: [],
      },
      timeMs: Date.now() - startTime,
    };
  }
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
  const startTime = Date.now();
  const config = loadConfig();
  const runId = generateRunId();

  console.log('🚀 AI Search Quality Testing');
  console.log(`   Run ID: ${runId}`);
  console.log(`   Query count: ${config.queryCount}`);
  console.log(`   Search mode: ${config.searchMode}\n`);

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

  // Phase 1: Generate queries
  const { queries } = generateQueries(config);

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

    console.log(`  ${progress} "${q.query.slice(0, 40)}${q.query.length > 40 ? '...' : ''}" - overall: ${evaluation.scores.overall.toFixed(2)}`);
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

  // Find lowest scoring dimension for focus recommendation
  const dimensions = ['relevance', 'ranking', 'coverage', 'snippetQuality'] as const;
  const lowestDim = dimensions.reduce((min, dim) =>
    summary.averageScores[dim] < summary.averageScores[min] ? dim : min
  );

  console.log(`\n💡 Recommended focus: ${lowestDim} (avg: ${summary.averageScores[lowestDim]})`);
}

main().catch(console.error);
