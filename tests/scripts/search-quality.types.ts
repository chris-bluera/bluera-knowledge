/**
 * Type definitions for AI-powered search quality testing
 */

// Configuration types
export interface QualityConfig {
  queryCount: number;
  searchLimit: number;
  searchMode: 'hybrid' | 'semantic' | 'keyword';
  stores: string[] | null;
  timeoutMs: number;
  querySet: 'core' | 'explore' | string;
  corpusVersion: string;
}

// Query set types
export interface CoreQuery {
  id: string;
  query: string;
  intent: string;
  taskContext?: string; // What the agent is trying to accomplish
  category: 'implementation' | 'debugging' | 'understanding' | 'decision' | 'pattern';
  expectedSources?: string[];
}

export interface QuerySet {
  version: string;
  description: string;
  queries: CoreQuery[];
  source?: 'curated' | 'ai-generated';
  generatedAt?: string;
}

// Baseline types
export interface BaselineScores {
  relevance: number;
  ranking: number;
  coverage: number;
  snippetQuality: number;
  overall: number;
}

export interface Baseline {
  updatedAt: string;
  corpus: string;
  querySet: string;
  scores: BaselineScores;
  thresholds: {
    regression: number;
    improvement: number;
  };
}

// Query generation types
export interface GeneratedQuery {
  id?: string;
  query: string;
  intent: string;
  taskContext?: string;
  expectedContentTypes?: string[];
}

export interface QueryGenerationResult {
  queries: GeneratedQuery[];
}

// Evaluation types
export interface Scores {
  relevance: number;
  ranking: number;
  coverage: number;
  snippetQuality: number;
  overall: number;
}

export interface Analysis {
  relevance: string;
  ranking: string;
  coverage: string;
  snippetQuality: string;
}

export interface ResultAssessment {
  rank: number;
  source: string;
  relevant: boolean;
  note?: string;
}

export interface EvaluationResult {
  scores: Scores;
  analysis: Analysis;
  suggestions: string[];
  resultAssessments: ResultAssessment[];
}

// Search result types (from CLI output)
export interface SearchResult {
  source: string;
  title?: string;
  snippet: string;
  score?: number;
  store?: string;
}

// Per-query evaluation output
export interface QueryEvaluation {
  timestamp: string;
  query: GeneratedQuery;
  searchResults: SearchResult[];
  evaluation: EvaluationResult;
  searchTimeMs: number;
  evaluationTimeMs: number;
}

// Run summary types
export interface RunSummary {
  timestamp: string;
  runId: string;
  config: QualityConfig;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageScores: Scores;
  queryEvaluations: QueryEvaluation[];
  topSuggestions: string[];
  totalTimeMs: number;
}

// JSONL line type (for output file)
export type QualityResultLine =
  | { type: 'run_start'; timestamp: string; runId: string; config: QualityConfig }
  | { type: 'query_evaluation'; data: QueryEvaluation }
  | { type: 'run_summary'; data: RunSummary };

// HIL (Human-in-the-Loop) types
export type HilJudgment = 'good' | 'okay' | 'poor' | 'terrible';

export const HIL_JUDGMENT_SCORES: Record<HilJudgment, number> = {
  good: 1.0,
  okay: 0.7,
  poor: 0.4,
  terrible: 0.1,
};

export interface HilQueryData {
  reviewed: boolean;
  judgment?: HilJudgment;
  humanScore?: number;
  note?: string;
  flagged?: boolean;
  reviewedAt?: string;
}

export interface HilReviewSummary {
  reviewedAt: string;
  queriesReviewed: number;
  queriesSkipped: number;
  queriesFlagged: number;
  humanAverageScore: number;
  aiVsHumanDelta: number;
  synthesis: string;
  actionItems: string[];
}

// Extended types with HIL support
export interface QueryEvaluationWithHil extends QueryEvaluation {
  hil?: HilQueryData;
}

export interface RunSummaryWithHil extends RunSummary {
  hilReview?: HilReviewSummary;
}
