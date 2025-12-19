import { CheckpointService } from './checkpoint.js';
import { ChangeApplier } from './change-applier.js';
import type {
  Scores,
  ScoreDimension,
  Change,
  AgentRecommendation,
  AutoImproveOptions,
  AutoImproveResult,
  IterationResult,
  QualityRunSummary,
  IndexState,
} from './types.js';

/**
 * Interface for running quality tests.
 * Allows injection of mock implementations for testing.
 */
export interface QualityRunner {
  getLatestRun(runId?: string): Promise<QualityRunSummary>;
  runQualityTest(): Promise<Scores>;
}

/**
 * Interface for running improvement agents.
 * Allows injection of mock implementations for testing.
 */
export interface AgentRunner {
  runAgents(context: AgentContext): Promise<AgentRecommendation[]>;
}

export interface AgentContext {
  baselineScores: Scores;
  lowestDimension: ScoreDimension;
  focusDimension?: ScoreDimension;
  projectRoot: string;
}

export interface OrchestratorConfig {
  projectRoot: string;
  checkpointDir: string;
  resultsDir: string;
  qualityRunner: QualityRunner;
  agentRunner: AgentRunner;
}

/**
 * Orchestrates the auto-improvement loop:
 * 1. Read quality results
 * 2. Create checkpoint
 * 3. Spawn agents for recommendations
 * 4. Apply changes
 * 5. Re-run quality tests
 * 6. Evaluate and continue/rollback
 */
export class AutoImproveOrchestrator {
  private projectRoot: string;
  private checkpointService: CheckpointService;
  private changeApplier: ChangeApplier;
  private qualityRunner: QualityRunner;
  private agentRunner: AgentRunner;

  constructor(config: OrchestratorConfig) {
    this.projectRoot = config.projectRoot;
    this.checkpointService = new CheckpointService(config.checkpointDir);
    this.changeApplier = new ChangeApplier(config.projectRoot);
    this.qualityRunner = config.qualityRunner;
    this.agentRunner = config.agentRunner;
  }

  async run(options: AutoImproveOptions): Promise<AutoImproveResult> {
    const iterations: IterationResult[] = [];
    let currentScores: Scores;
    let totalChangesApplied = 0;

    // Get baseline from latest run or specified run
    const baseline = await this.qualityRunner.getLatestRun(options.runId);
    currentScores = baseline.averageScores;

    const initialScore = currentScores.overall;

    for (let i = 0; i < options.maxIterations; i++) {
      const iterResult = await this.runIteration(
        i + 1,
        currentScores,
        baseline.lowestDimension,
        options
      );

      iterations.push(iterResult);

      if (!iterResult.rolledBack) {
        currentScores = iterResult.newScores;
        totalChangesApplied += iterResult.appliedChanges.length;
      }

      // Check stop conditions
      if (currentScores.overall >= options.targetScore) {
        return {
          success: true,
          iterations,
          finalScores: currentScores,
          totalImprovement: currentScores.overall - initialScore,
          changesApplied: totalChangesApplied,
          message: `target score ${options.targetScore} reached (${currentScores.overall.toFixed(3)})`,
        };
      }

      // Check for diminishing returns (only if we actually made progress, not rolled back)
      // Use a small epsilon for floating point comparison
      if (!iterResult.rolledBack && iterResult.improvement < options.minImprovement - 0.0001) {
        return {
          success: true,
          iterations,
          finalScores: currentScores,
          totalImprovement: currentScores.overall - initialScore,
          changesApplied: totalChangesApplied,
          message: 'Stopped: diminishing returns (improvement below threshold)',
        };
      }
    }

    return {
      success: true,
      iterations,
      finalScores: currentScores,
      totalImprovement: currentScores.overall - initialScore,
      changesApplied: totalChangesApplied,
      message: `Completed max iterations (${options.maxIterations})`,
    };
  }

  private async runIteration(
    iterationNumber: number,
    currentScores: Scores,
    lowestDimension: ScoreDimension,
    options: AutoImproveOptions
  ): Promise<IterationResult> {
    // Determine focus dimension
    const focusDimension = options.focus === 'auto' ? lowestDimension : options.focus;

    // Get agent recommendations
    const recommendations = await this.agentRunner.runAgents({
      baselineScores: currentScores,
      lowestDimension,
      focusDimension,
      projectRoot: this.projectRoot,
    });

    // Consolidate and resolve conflicts
    const consolidatedChanges = this.consolidateRecommendations(recommendations);

    if (options.dryRun) {
      return {
        iteration: iterationNumber,
        checkpointId: 'dry-run',
        recommendations,
        appliedChanges: consolidatedChanges, // Include proposed changes for display
        newScores: currentScores,
        improvement: 0,
        rolledBack: false,
        reason: `Dry run - ${consolidatedChanges.length} changes proposed (not applied)`,
      };
    }

    // Get files that will be modified
    const filesToBackup = [...new Set(consolidatedChanges.map(c => c.file))];

    // Create checkpoint
    const checkpoint = await this.checkpointService.create(
      filesToBackup,
      currentScores,
      { storeId: 'auto-improve', documentCount: 0 } as IndexState
    );

    // Apply changes
    const applyResult = await this.changeApplier.apply(consolidatedChanges);

    if (!applyResult.success) {
      // Rollback on application failure
      await this.checkpointService.restore(checkpoint.id);
      return {
        iteration: iterationNumber,
        checkpointId: checkpoint.id,
        recommendations,
        appliedChanges: [],
        newScores: currentScores,
        improvement: 0,
        rolledBack: true,
        reason: `Failed to apply changes: ${applyResult.errors.join(', ')}`,
      };
    }

    // Run quality test
    const newScores = await this.qualityRunner.runQualityTest();
    const improvement = newScores.overall - currentScores.overall;

    // Check if we need to rollback
    if (improvement < -options.rollbackThreshold) {
      await this.checkpointService.restore(checkpoint.id);
      return {
        iteration: iterationNumber,
        checkpointId: checkpoint.id,
        recommendations,
        appliedChanges: consolidatedChanges,
        newScores: currentScores, // Restored to original
        improvement: 0,
        rolledBack: true,
        reason: `Score degraded by ${(-improvement).toFixed(3)}, exceeding threshold`,
      };
    }

    return {
      iteration: iterationNumber,
      checkpointId: checkpoint.id,
      recommendations,
      appliedChanges: consolidatedChanges,
      newScores,
      improvement,
      rolledBack: false,
    };
  }

  /**
   * Consolidates recommendations from multiple agents.
   * Resolves conflicts by choosing highest confidence change per file.
   */
  private consolidateRecommendations(recommendations: AgentRecommendation[]): Change[] {
    // Group changes by file
    const changesByFile = new Map<string, { change: Change; confidence: number }[]>();

    for (const rec of recommendations) {
      for (const change of rec.changes) {
        const existing = changesByFile.get(change.file) ?? [];
        existing.push({ change, confidence: rec.confidence });
        changesByFile.set(change.file, existing);
      }
    }

    // Select highest confidence change per file
    const selectedChanges: Change[] = [];
    for (const [_file, changes] of changesByFile) {
      changes.sort((a, b) => b.confidence - a.confidence);
      if (changes[0] !== undefined) {
        selectedChanges.push(changes[0].change);
      }
    }

    // Sort by priority (config before code before reindex)
    const typePriority: Record<string, number> = { config: 1, code: 2, reindex: 3 };
    selectedChanges.sort((a, b) => {
      const typeOrder = (typePriority[a.type] ?? 99) - (typePriority[b.type] ?? 99);
      if (typeOrder !== 0) return typeOrder;
      return a.priority - b.priority;
    });

    return selectedChanges;
  }
}
