import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execSync } from 'node:child_process';
import type { QualityRunner } from './orchestrator.js';
import type { Scores, ScoreDimension, QualityRunSummary } from './types.js';

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

  runQualityTest(): Promise<Scores> {
    // Run the quality test using the CLI
    const output = execSync('node dist/index.js quality test --quiet', {
      cwd: this.projectRoot,
      encoding: 'utf-8',
      timeout: 1800000, // 30 minutes - quality tests with 15-17 queries can take 7-22 minutes
      maxBuffer: 10 * 1024 * 1024,
    });

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

    return Promise.resolve(summary.averageScores);
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
}
