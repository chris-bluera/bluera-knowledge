import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import type { QualityRunner } from './orchestrator.js';
import type { Scores, ScoreDimension, QualityRunSummary, TestConfig, ValidationResult } from './types.js';

interface RunFileLine {
  type: string;
  data?: {
    timestamp?: string;
    runId?: string;
    config?: { querySet: string };
    totalQueries?: number;
    averageScores?: Scores;
  };
}

/**
 * Production implementation of QualityRunner.
 * Reads quality results from disk and runs quality tests via CLI.
 */
export class ProductionQualityRunner implements QualityRunner {
  private readonly resultsDir: string;
  private readonly projectRoot: string;

  constructor(resultsDir: string, projectRoot: string) {
    this.resultsDir = resultsDir;
    this.projectRoot = projectRoot;
  }

  getLatestRun(runId?: string): Promise<QualityRunSummary> {
    const runs = this.listRuns();

    if (runs.length === 0) {
      throw new Error('No quality runs found. Run `quality test` first.');
    }

    let targetRun: { id: string; path: string };
    if (runId !== undefined) {
      const found = runs.find(r => r.id === runId || r.id.includes(runId));
      if (found === undefined) {
        throw new Error(`Quality run not found: ${runId}`);
      }
      targetRun = found;
    } else {
      const latest = runs[0];
      if (latest === undefined) {
        throw new Error('No quality runs found.');
      }
      targetRun = latest;
    }

    const summary = this.parseRunSummary(targetRun.path);
    if (summary === null) {
      throw new Error(`Run ${targetRun.id} has no summary data.`);
    }

    const lowestDimension = this.findLowestDimension(summary.averageScores);

    return Promise.resolve({
      runId: targetRun.id,
      timestamp: summary.timestamp,
      averageScores: summary.averageScores,
      queryCount: summary.totalQueries,
      lowestDimension,
    });
  }

  runQualityTest(config?: TestConfig): Promise<ValidationResult> {
    // Use default config if not provided
    const testConfig = config ?? {
      tier: 'quick' as const,
      querySet: 'core',
      queryCount: 17,
    };

    // Generous timeouts - only fail if process is truly stuck
    // Quick (17 queries): ~5-15 min expected, 1 hour timeout (4x max)
    // Comprehensive (60 queries): ~60-90 min expected, 4 hour timeout (2.5x max)
    const timeout = testConfig.tier === 'comprehensive'
      ? 14400000  // 4 hours for comprehensive
      : 3600000;  // 1 hour for quick

    // Build CLI command with specific query set
    const args = ['quality', 'test', '--set', testConfig.querySet, '--quiet'];
    const command = `node dist/index.js ${args.join(' ')}`;

    // Run the quality test using the CLI
    let output: string;
    try {
      output = execSync(command, {
        cwd: this.projectRoot,
        encoding: 'utf-8',
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error: unknown) {
      // Check if this was a timeout
      if (error instanceof Error && 'killed' in error && error.killed && 'signal' in error) {
        throw new Error(
          `Quality test timed out after ${timeout / 60000} minutes - process may be stuck. ` +
          `Expected ${testConfig.queryCount} queries on ${testConfig.querySet} set.`
        );
      }
      throw error;
    }

    // Parse the output to find the score
    const overallMatch = output.match(/Average overall score:\s*([\d.]+)/);
    if (overallMatch === null || overallMatch[1] === undefined) {
      throw new Error('Failed to parse quality test output');
    }

    // Get the latest run to retrieve full scores
    const runs = this.listRuns();
    if (runs.length === 0 || runs[0] === undefined) {
      throw new Error('Quality test completed but no run found');
    }

    const summary = this.parseRunSummary(runs[0].path);
    if (summary === null) {
      throw new Error('Quality test completed but no summary found');
    }

    // CRITICAL: Validate run completed expected number of queries
    if (summary.totalQueries < testConfig.queryCount) {
      throw new Error(
        `Incomplete test run: only ${summary.totalQueries}/${testConfig.queryCount} queries completed. ` +
        `Test may have failed or timed out before completion.`
      );
    }

    return Promise.resolve({
      tier: testConfig.tier,
      scores: summary.averageScores,
      queryCount: summary.totalQueries,
      passed: true, // Will be determined by caller based on thresholds
      confidence: this.calculateConfidence(summary.totalQueries),
    });
  }

  private listRuns(): Array<{ id: string; path: string }> {
    if (!existsSync(this.resultsDir)) {
      return [];
    }

    return readdirSync(this.resultsDir)
      .filter(f => f.endsWith('.jsonl'))
      .sort()
      .reverse()
      .map(file => ({
        id: basename(file, '.jsonl'),
        path: join(this.resultsDir, file),
      }));
  }

  private parseRunSummary(path: string): {
    timestamp: string;
    totalQueries: number;
    averageScores: Scores;
  } | null {
    const content = readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      const parsed = JSON.parse(line) as RunFileLine;
      if (parsed.type === 'run_summary' && parsed.data !== undefined) {
        return {
          timestamp: parsed.data.timestamp ?? '',
          totalQueries: parsed.data.totalQueries ?? 0,
          averageScores: parsed.data.averageScores ?? {
            relevance: 0,
            ranking: 0,
            coverage: 0,
            snippetQuality: 0,
            overall: 0,
          },
        };
      }
    }

    return null;
  }

  private findLowestDimension(scores: Scores): ScoreDimension {
    const dimensions: ScoreDimension[] = ['relevance', 'ranking', 'coverage', 'snippetQuality'];
    return dimensions.reduce((min, dim) =>
      scores[dim] < scores[min] ? dim : min
    );
  }

  private calculateConfidence(sampleSize: number): number {
    // Confidence decreases with smaller samples
    // 60+ queries = 0.95, 17 queries = 0.70, 10 queries = 0.60
    if (sampleSize >= 60) return 0.95;
    if (sampleSize >= 30) return 0.85;
    if (sampleSize >= 17) return 0.70;
    if (sampleSize >= 10) return 0.60;
    return 0.50;
  }
}
