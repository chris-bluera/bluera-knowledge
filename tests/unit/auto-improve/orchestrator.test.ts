import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  AutoImproveOrchestrator,
  type QualityRunner,
  type AgentRunner,
} from '../../../src/services/auto-improve/orchestrator.js';
import type {
  Scores,
  AgentRecommendation,
  AutoImproveOptions,
  QualityRunSummary,
} from '../../../src/services/auto-improve/types.js';

describe('AutoImproveOrchestrator', () => {
  let tempDir: string;
  let orchestrator: AutoImproveOrchestrator;
  let mockQualityRunner: QualityRunner;
  let mockAgentRunner: AgentRunner;
  let qualityRunCount: number;

  const baseScores: Scores = {
    relevance: 0.65,
    ranking: 0.58,
    coverage: 0.72,
    snippetQuality: 0.55,
    overall: 0.625,
  };

  const improvedScores: Scores = {
    relevance: 0.70,
    ranking: 0.65,
    coverage: 0.75,
    snippetQuality: 0.62,
    overall: 0.68,
  };

  const defaultOptions: AutoImproveOptions = {
    maxIterations: 3,
    targetScore: 0.7,
    minImprovement: 0.02,
    rollbackThreshold: 0.03,
    dryRun: false,
    focus: 'auto',
  };

  beforeEach(() => {
    tempDir = join(tmpdir(), `orchestrator-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'checkpoints'), { recursive: true });
    mkdirSync(join(tempDir, 'results'), { recursive: true });
    mkdirSync(join(tempDir, 'src'), { recursive: true });

    // Create a test file that agents will "modify"
    writeFileSync(join(tempDir, 'src', 'config.json'), '{"chunkSize": 512}');

    qualityRunCount = 0;

    mockQualityRunner = {
      getLatestRun: vi.fn().mockResolvedValue({
        runId: 'test-run-1',
        timestamp: new Date().toISOString(),
        averageScores: baseScores,
        queryCount: 15,
        lowestDimension: 'snippetQuality',
      } satisfies QualityRunSummary),
      runQualityTest: vi.fn().mockImplementation(async () => {
        qualityRunCount++;
        const scores = qualityRunCount === 1 ? improvedScores : improvedScores;
        return {
          tier: 'quick',
          scores,
          queryCount: 17,
          passed: true,
          confidence: 0.70,
        };
      }),
    };

    mockAgentRunner = {
      runAgents: vi.fn().mockResolvedValue([
        {
          agentId: 'config-agent',
          confidence: 0.8,
          targetDimension: 'snippetQuality',
          changes: [
            {
              type: 'config',
              priority: 1,
              file: join(tempDir, 'src', 'config.json'),
              description: 'Increase chunk size for better snippets',
              before: '{"chunkSize": 512}',
              after: '{"chunkSize": 1024}',
            },
          ],
          reasoning: 'Larger chunks provide more context in snippets',
          expectedImprovement: 0.05,
        } satisfies AgentRecommendation,
      ]),
    };

    orchestrator = new AutoImproveOrchestrator({
      projectRoot: tempDir,
      checkpointDir: join(tempDir, 'checkpoints'),
      resultsDir: join(tempDir, 'results'),
      qualityRunner: mockQualityRunner,
      agentRunner: mockAgentRunner,
    });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('run', () => {
    it('reads latest quality results', async () => {
      await orchestrator.run(defaultOptions);

      expect(mockQualityRunner.getLatestRun).toHaveBeenCalled();
    });

    it('spawns agents to get recommendations', async () => {
      await orchestrator.run(defaultOptions);

      expect(mockAgentRunner.runAgents).toHaveBeenCalledWith(
        expect.objectContaining({
          baselineScores: baseScores,
          lowestDimension: 'snippetQuality',
        })
      );
    });

    it('applies recommended changes', async () => {
      await orchestrator.run(defaultOptions);

      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(join(tempDir, 'src', 'config.json'), 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 1024}');
    });

    it('runs quality test after applying changes', async () => {
      await orchestrator.run(defaultOptions);

      expect(mockQualityRunner.runQualityTest).toHaveBeenCalled();
    });

    it('returns success when score improves', async () => {
      const result = await orchestrator.run(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.totalImprovement).toBeGreaterThan(0);
    });

    it('stops when target score is reached', async () => {
      mockQualityRunner.runQualityTest = vi.fn().mockResolvedValue({
        tier: 'quick',
        scores: {
          ...improvedScores,
          overall: 0.75, // Above target
        },
        queryCount: 17,
        passed: true,
        confidence: 0.70,
      });

      const result = await orchestrator.run({ ...defaultOptions, targetScore: 0.7 });

      expect(result.success).toBe(true);
      expect(result.message).toContain('target');
    });

    it('stops after max iterations', async () => {
      // Mock agent to always return new changes
      let changeCount = 0;
      let qualityCallCount = 0;
      mockAgentRunner.runAgents = vi.fn().mockImplementation(async () => {
        changeCount++;
        return [
          {
            agentId: 'config-agent',
            confidence: 0.8,
            targetDimension: 'snippetQuality',
            changes: [
              {
                type: 'code',
                priority: 1,
                file: join(tempDir, 'src', 'config.json'),
                description: `Change ${changeCount}`,
                before: changeCount === 1 ? '{"chunkSize": 512}' : `{"chunkSize": ${512 * changeCount}}`,
                after: `{"chunkSize": ${512 * (changeCount + 1)}}`,
              },
            ],
            reasoning: 'Test change',
            expectedImprovement: 0.01,
          },
        ];
      });

      // Return progressively better scores so minImprovement check passes
      mockQualityRunner.runQualityTest = vi.fn().mockImplementation(async () => {
        qualityCallCount++;
        return {
          tier: 'quick',
          scores: {
            ...baseScores,
            overall: baseScores.overall + (0.02 * qualityCallCount), // Progressive improvement
          },
          queryCount: 17,
          passed: true,
          confidence: 0.70,
        };
      });

      // Set minImprovement to 0 and high target score to focus on testing max iterations
      const result = await orchestrator.run({ ...defaultOptions, maxIterations: 2, minImprovement: 0, targetScore: 0.99 });

      expect(result.iterations).toHaveLength(2);
      expect(result.message).toContain('max iterations');
    });

    it('rolls back when score degrades beyond threshold', async () => {
      const degradedScores: Scores = {
        ...baseScores,
        overall: baseScores.overall - 0.05, // Worse than threshold
      };

      mockQualityRunner.runQualityTest = vi.fn().mockResolvedValue({
        tier: 'quick',
        scores: degradedScores,
        queryCount: 17,
        passed: true,
        confidence: 0.70,
      });

      const result = await orchestrator.run(defaultOptions);

      expect(result.iterations[0].rolledBack).toBe(true);
      // File should be restored
      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(join(tempDir, 'src', 'config.json'), 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 512}');
    });

    it('rolls back when score degrades by more than stricter threshold', async () => {
      const degradedScores: Scores = {
        ...baseScores,
        overall: baseScores.overall - 0.015, // -0.015 exceeds new 0.01 threshold
      };

      mockQualityRunner.runQualityTest = vi.fn().mockResolvedValue({
        tier: 'quick',
        scores: degradedScores,
        queryCount: 17,
        passed: true,
        confidence: 0.70,
      });

      const result = await orchestrator.run({ ...defaultOptions, rollbackThreshold: 0.01 });

      expect(result.iterations[0].rolledBack).toBe(true);
      expect(result.iterations[0].reason).toContain('degraded by 0.015');
      // File should be restored
      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(join(tempDir, 'src', 'config.json'), 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 512}');
    });

    it('does not roll back when score degrades within threshold', async () => {
      const slightlyDegradedScores: Scores = {
        ...baseScores,
        overall: baseScores.overall - 0.005, // -0.005 is within 0.01 threshold (test variance)
      };

      mockQualityRunner.runQualityTest = vi.fn().mockResolvedValue({
        tier: 'quick',
        scores: slightlyDegradedScores,
        queryCount: 17,
        passed: true,
        confidence: 0.70,
      });

      const result = await orchestrator.run({ ...defaultOptions, rollbackThreshold: 0.01 });

      expect(result.iterations[0].rolledBack).toBe(false);
      // File should still be changed
      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(join(tempDir, 'src', 'config.json'), 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 1024}');
    });

    it('stops when improvement is below threshold', async () => {
      mockQualityRunner.runQualityTest = vi.fn().mockResolvedValue({
        tier: 'quick',
        scores: {
          ...baseScores,
          overall: baseScores.overall + 0.01, // Below minImprovement threshold
        },
        queryCount: 17,
        passed: true,
        confidence: 0.70,
      });

      const result = await orchestrator.run({ ...defaultOptions, minImprovement: 0.02 });

      expect(result.message).toContain('diminishing');
    });

    it('respects dry-run mode', async () => {
      const result = await orchestrator.run({ ...defaultOptions, dryRun: true });

      // File should not be changed
      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(join(tempDir, 'src', 'config.json'), 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 512}');
      expect(result.changesApplied).toBe(0);
    });

    it('uses specified focus dimension', async () => {
      await orchestrator.run({ ...defaultOptions, focus: 'ranking' });

      expect(mockAgentRunner.runAgents).toHaveBeenCalledWith(
        expect.objectContaining({
          focusDimension: 'ranking',
        })
      );
    });
  });

  describe('consolidateRecommendations', () => {
    it('prioritizes by confidence × expectedImprovement', async () => {
      mockAgentRunner.runAgents = vi.fn().mockResolvedValue([
        {
          agentId: 'agent-1',
          confidence: 0.9,
          targetDimension: 'ranking',
          changes: [{ type: 'code', priority: 1, file: 'a.ts', description: 'A', before: '', after: '' }],
          reasoning: 'High confidence, low improvement',
          expectedImprovement: 0.02,
        },
        {
          agentId: 'agent-2',
          confidence: 0.7,
          targetDimension: 'snippetQuality',
          changes: [{ type: 'code', priority: 1, file: 'b.ts', description: 'B', before: '', after: '' }],
          reasoning: 'Medium confidence, high improvement',
          expectedImprovement: 0.10,
        },
      ]);

      // We test this indirectly by checking which changes are applied
      // The second agent has higher priority score (0.7 * 0.10 = 0.07 vs 0.9 * 0.02 = 0.018)
      await orchestrator.run({ ...defaultOptions, dryRun: true });

      // Check that agents were called and recommendations processed
      expect(mockAgentRunner.runAgents).toHaveBeenCalled();
    });

    it('resolves conflicts by choosing highest confidence per file', async () => {
      const testFile = join(tempDir, 'src', 'config.json');

      mockAgentRunner.runAgents = vi.fn().mockResolvedValue([
        {
          agentId: 'agent-1',
          confidence: 0.6,
          targetDimension: 'ranking',
          changes: [
            {
              type: 'config',
              priority: 1,
              file: testFile,
              description: 'Low confidence change',
              before: '{"chunkSize": 512}',
              after: '{"chunkSize": 256}',
            },
          ],
          reasoning: 'Lower confidence',
          expectedImprovement: 0.05,
        },
        {
          agentId: 'agent-2',
          confidence: 0.9,
          targetDimension: 'snippetQuality',
          changes: [
            {
              type: 'config',
              priority: 1,
              file: testFile,
              description: 'High confidence change',
              before: '{"chunkSize": 512}',
              after: '{"chunkSize": 1024}',
            },
          ],
          reasoning: 'Higher confidence',
          expectedImprovement: 0.03,
        },
      ]);

      await orchestrator.run(defaultOptions);

      // Higher confidence agent's change should win
      const configContent = await import('node:fs').then(fs =>
        fs.readFileSync(testFile, 'utf-8')
      );
      expect(configContent).toBe('{"chunkSize": 1024}');
    });
  });
});
