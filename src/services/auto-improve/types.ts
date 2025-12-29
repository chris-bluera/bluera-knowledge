/**
 * Shared types for the auto-improve service
 */

export interface Scores {
  relevance: number;
  ranking: number;
  coverage: number;
  snippetQuality: number;
  overall: number;
}

export type ScoreDimension = keyof Scores;

export type ValidationTier = 'quick' | 'comprehensive';

export type ChangeType = 'config' | 'code' | 'reindex';

export interface Change {
  type: ChangeType;
  priority: number;
  file: string;
  description: string;
  before: string;
  after: string;
}

export interface AgentRecommendation {
  agentId: string;
  confidence: number;
  targetDimension: ScoreDimension;
  changes: Change[];
  reasoning: string;
  expectedImprovement: number;
}

export interface Checkpoint {
  id: string;
  createdAt: string;
  baselineScores: Scores;
  files: CheckpointFile[];
  indexState: IndexState;
}

export interface CheckpointFile {
  path: string;
  content: string;
}

export interface IndexState {
  storeId: string;
  documentCount: number;
}

export interface TestConfig {
  tier: ValidationTier;
  querySet: string; // 'core' | 'extended'
  queryCount: number;
}

export interface ValidationResult {
  tier: ValidationTier;
  scores: Scores;
  queryCount: number;
  passed: boolean;
  confidence?: number;
}

export interface IterationResult {
  iteration: number;
  checkpointId: string;
  recommendations: AgentRecommendation[];
  appliedChanges: Change[];
  quickValidation: ValidationResult;
  comprehensiveValidation?: ValidationResult;
  newScores: Scores;
  improvement: number;
  rolledBack: boolean;
  reason?: string;
}

export interface AutoImproveOptions {
  runId?: string;
  maxIterations: number;
  targetScore: number;
  minImprovement: number;
  rollbackThreshold: number;
  dryRun: boolean;
  focus: ScoreDimension | 'auto';
  quickTestConfig?: TestConfig;
  comprehensiveTestConfig?: TestConfig;
  requireComprehensiveValidation?: boolean;
  statisticalSignificanceLevel?: number;
}

export interface AutoImproveResult {
  success: boolean;
  iterations: IterationResult[];
  finalScores: Scores;
  totalImprovement: number;
  changesApplied: number;
  message: string;
}

export interface QualityRunSummary {
  runId: string;
  timestamp: string;
  averageScores: Scores;
  queryCount: number;
  lowestDimension: ScoreDimension;
}
