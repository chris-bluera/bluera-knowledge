/**
 * Search Relevance Utilities
 *
 * Helpers for validating search result quality and relevance.
 */

/**
 * Search result item (matches CLI output structure)
 */
export interface SearchResult {
  /** Result ranking position (1-based) */
  rank: number;
  /** Relevance score (0-1) */
  score: number;
  /** Source file path */
  source: string;
  /** Content snippet */
  content: string;
}

/**
 * Expected match for relevance testing
 */
export interface ExpectedMatch {
  /** Keywords that should appear in content (any of these) */
  keywords?: string[];
  /** All of these keywords must appear */
  requiredKeywords?: string[];
  /** Source file should contain this string */
  sourceContains?: string;
  /** Minimum acceptable score */
  minScore?: number;
  /** Maximum acceptable rank position */
  maxRank?: number;
}

/**
 * Parse CLI search output into structured results
 *
 * @param output - Raw CLI output from search command
 * @returns Array of parsed search results
 *
 * @example
 * const output = cli('search "authentication"');
 * const results = parseSearchOutput(output);
 */
export function parseSearchOutput(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = output.split('\n');

  let currentResult: Partial<SearchResult> | null = null;
  let rank = 0;

  for (const line of lines) {
    // Match result header: "1. [0.85] path/to/file.ts" or "1. [-0.23] path/to/file.ts"
    const headerMatch = line.match(/^(\d+)\.\s+\[(-?[0-9.]+)\]\s+(.+)$/);
    if (headerMatch) {
      if (currentResult && currentResult.content) {
        results.push(currentResult as SearchResult);
      }
      rank++;
      currentResult = {
        rank,
        score: parseFloat(headerMatch[2]),
        source: headerMatch[3].trim(),
        content: '',
      };
      continue;
    }

    // Accumulate content lines (indented with spaces)
    if (currentResult && line.startsWith('   ')) {
      currentResult.content += (currentResult.content ? '\n' : '') + line.trim();
    }
  }

  // Don't forget the last result
  if (currentResult && currentResult.content) {
    results.push(currentResult as SearchResult);
  }

  return results;
}

/**
 * Check if a result matches expected criteria
 *
 * @param result - Search result to check
 * @param expected - Expected match criteria
 * @returns true if result matches all criteria
 */
export function matchesExpectation(
  result: SearchResult,
  expected: ExpectedMatch
): boolean {
  const contentLower = result.content.toLowerCase();
  const sourceLower = result.source.toLowerCase();

  // Check keywords (any match)
  if (expected.keywords && expected.keywords.length > 0) {
    const hasKeyword = expected.keywords.some((kw) =>
      contentLower.includes(kw.toLowerCase())
    );
    if (!hasKeyword) return false;
  }

  // Check required keywords (all must match)
  if (expected.requiredKeywords && expected.requiredKeywords.length > 0) {
    const hasAllRequired = expected.requiredKeywords.every((kw) =>
      contentLower.includes(kw.toLowerCase())
    );
    if (!hasAllRequired) return false;
  }

  // Check source path
  if (expected.sourceContains) {
    if (!sourceLower.includes(expected.sourceContains.toLowerCase())) {
      return false;
    }
  }

  // Check minimum score
  if (expected.minScore !== undefined && result.score < expected.minScore) {
    return false;
  }

  // Check maximum rank
  if (expected.maxRank !== undefined && result.rank > expected.maxRank) {
    return false;
  }

  return true;
}

/**
 * Assert that results contain at least one match for expected criteria
 *
 * @param results - Search results to check
 * @param expected - Expected match criteria
 * @returns The first matching result, or throws if none found
 */
export function assertHasMatch(
  results: SearchResult[],
  expected: ExpectedMatch
): SearchResult {
  const match = results.find((r) => matchesExpectation(r, expected));
  if (!match) {
    const criteria = JSON.stringify(expected, null, 2);
    const resultsSummary = results
      .map((r) => `  ${r.rank}. [${r.score}] ${r.source}`)
      .join('\n');
    throw new Error(
      `No result matches expected criteria:\n${criteria}\n\nResults:\n${resultsSummary}`
    );
  }
  return match;
}

/**
 * Assert that the top N results all match expected criteria
 *
 * @param results - Search results to check
 * @param expected - Expected match criteria
 * @param topN - Number of top results to check (default: 3)
 */
export function assertTopResultsMatch(
  results: SearchResult[],
  expected: ExpectedMatch,
  topN = 3
): void {
  const topResults = results.slice(0, topN);

  for (const result of topResults) {
    if (!matchesExpectation(result, expected)) {
      throw new Error(
        `Top ${topN} result at rank ${result.rank} does not match expected criteria:\n` +
          `Expected: ${JSON.stringify(expected)}\n` +
          `Got: ${result.source} - "${result.content.slice(0, 100)}..."`
      );
    }
  }
}

/**
 * Calculate relevance metrics for a set of results
 *
 * @param results - Search results
 * @param expected - Expected match criteria for "relevant" results
 * @returns Relevance metrics
 */
export function calculateRelevanceMetrics(
  results: SearchResult[],
  expected: ExpectedMatch
): {
  precision: number;
  relevantCount: number;
  totalCount: number;
  averageScore: number;
  topScore: number;
} {
  const relevant = results.filter((r) => matchesExpectation(r, expected));

  return {
    precision: results.length > 0 ? relevant.length / results.length : 0,
    relevantCount: relevant.length,
    totalCount: results.length,
    averageScore:
      results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0,
    topScore: results.length > 0 ? results[0].score : 0,
  };
}

/**
 * Compare relevance between two search result sets
 *
 * @param baseline - Baseline results
 * @param comparison - Results to compare
 * @param expected - Expected match criteria
 * @returns Comparison metrics
 */
export function compareRelevance(
  baseline: SearchResult[],
  comparison: SearchResult[],
  expected: ExpectedMatch
): {
  baselineMetrics: ReturnType<typeof calculateRelevanceMetrics>;
  comparisonMetrics: ReturnType<typeof calculateRelevanceMetrics>;
  precisionDiff: number;
  scoreDiff: number;
} {
  const baselineMetrics = calculateRelevanceMetrics(baseline, expected);
  const comparisonMetrics = calculateRelevanceMetrics(comparison, expected);

  return {
    baselineMetrics,
    comparisonMetrics,
    precisionDiff: comparisonMetrics.precision - baselineMetrics.precision,
    scoreDiff: comparisonMetrics.topScore - baselineMetrics.topScore,
  };
}

/**
 * Assert minimum relevance score for results
 *
 * @param results - Search results
 * @param minScore - Minimum acceptable score
 */
export function assertMinimumScores(
  results: SearchResult[],
  minScore: number
): void {
  for (const result of results) {
    if (result.score < minScore) {
      throw new Error(
        `Result at rank ${result.rank} has score ${result.score}, ` +
          `which is below minimum ${minScore}`
      );
    }
  }
}

/**
 * Check if results are properly ordered by score (descending)
 */
export function assertProperOrdering(results: SearchResult[]): void {
  for (let i = 1; i < results.length; i++) {
    if (results[i].score > results[i - 1].score) {
      throw new Error(
        `Results not properly ordered: rank ${i} has higher score ` +
          `(${results[i].score}) than rank ${i - 1} (${results[i - 1].score})`
      );
    }
  }
}

/**
 * Common keyword sets for testing
 */
export const CommonKeywords = {
  AUTHENTICATION: [
    'auth',
    'login',
    'jwt',
    'token',
    'password',
    'session',
    'oauth',
    'credential',
  ],
  API: [
    'endpoint',
    'request',
    'response',
    'rest',
    'http',
    'route',
    'controller',
    'middleware',
  ],
  DATABASE: [
    'query',
    'database',
    'repository',
    'entity',
    'model',
    'schema',
    'sql',
    'orm',
  ],
  TYPESCRIPT: [
    'typescript',
    'type',
    'interface',
    'generic',
    'compiler',
    'tsc',
  ],
  REACT: ['react', 'component', 'jsx', 'hook', 'state', 'props', 'render'],
  ERROR_HANDLING: [
    'error',
    'exception',
    'catch',
    'throw',
    'try',
    'handler',
    'validation',
  ],
} as const;
