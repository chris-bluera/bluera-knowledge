import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CheckpointService } from '../../../src/services/auto-improve/checkpoint.js';
import type { Scores, IndexState } from '../../../src/services/auto-improve/types.js';

describe('CheckpointService', () => {
  let tempDir: string;
  let checkpointService: CheckpointService;
  let testFiles: string[];

  const mockScores: Scores = {
    relevance: 0.65,
    ranking: 0.58,
    coverage: 0.72,
    snippetQuality: 0.55,
    overall: 0.625,
  };

  const mockIndexState: IndexState = {
    storeId: 'test-store-123',
    documentCount: 42,
  };

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = join(tmpdir(), `checkpoint-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'checkpoints'), { recursive: true });
    mkdirSync(join(tempDir, 'src'), { recursive: true });

    // Create test files to back up
    testFiles = [
      join(tempDir, 'src', 'config.json'),
      join(tempDir, 'src', 'search.ts'),
    ];
    writeFileSync(testFiles[0], '{"chunkSize": 512}');
    writeFileSync(testFiles[1], 'export function search() {}');

    checkpointService = new CheckpointService(join(tempDir, 'checkpoints'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('create', () => {
    it('creates a checkpoint with all specified files', async () => {
      const checkpoint = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.id.length).toBeGreaterThan(0);
      expect(checkpoint.createdAt).toBeDefined();
      expect(checkpoint.baselineScores).toEqual(mockScores);
      expect(checkpoint.indexState).toEqual(mockIndexState);
      expect(checkpoint.files).toHaveLength(2);
    });

    it('stores file contents in checkpoint', async () => {
      const checkpoint = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      const configFile = checkpoint.files.find(f => f.path.includes('config.json'));
      expect(configFile).toBeDefined();
      expect(configFile?.content).toBe('{"chunkSize": 512}');

      const searchFile = checkpoint.files.find(f => f.path.includes('search.ts'));
      expect(searchFile).toBeDefined();
      expect(searchFile?.content).toBe('export function search() {}');
    });

    it('persists checkpoint to disk', async () => {
      const checkpoint = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      const checkpointFile = join(tempDir, 'checkpoints', `${checkpoint.id}.json`);
      expect(existsSync(checkpointFile)).toBe(true);

      const saved = JSON.parse(readFileSync(checkpointFile, 'utf-8'));
      expect(saved.id).toBe(checkpoint.id);
      expect(saved.baselineScores).toEqual(mockScores);
    });

    it('handles missing files gracefully', async () => {
      const filesWithMissing = [...testFiles, join(tempDir, 'nonexistent.ts')];

      await expect(
        checkpointService.create(filesWithMissing, mockScores, mockIndexState)
      ).rejects.toThrow(/not found|ENOENT/i);
    });
  });

  describe('list', () => {
    it('returns empty array when no checkpoints exist', async () => {
      const checkpoints = await checkpointService.list();
      expect(checkpoints).toEqual([]);
    });

    it('returns all checkpoints sorted by creation time (newest first)', async () => {
      await checkpointService.create(testFiles, mockScores, mockIndexState);
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await checkpointService.create(testFiles, mockScores, mockIndexState);

      const checkpoints = await checkpointService.list();
      expect(checkpoints).toHaveLength(2);
      expect(new Date(checkpoints[0].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(checkpoints[1].createdAt).getTime());
    });
  });

  describe('get', () => {
    it('retrieves a checkpoint by ID', async () => {
      const created = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      const retrieved = await checkpointService.get(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.files).toHaveLength(2);
    });

    it('returns undefined for non-existent checkpoint', async () => {
      const result = await checkpointService.get('nonexistent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('restore', () => {
    it('restores files to their checkpointed state', async () => {
      const checkpoint = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      // Modify files
      writeFileSync(testFiles[0], '{"chunkSize": 1024, "modified": true}');
      writeFileSync(testFiles[1], 'export function search() { return null; }');

      // Verify modifications
      expect(readFileSync(testFiles[0], 'utf-8')).toBe('{"chunkSize": 1024, "modified": true}');

      // Restore
      await checkpointService.restore(checkpoint.id);

      // Verify restoration
      expect(readFileSync(testFiles[0], 'utf-8')).toBe('{"chunkSize": 512}');
      expect(readFileSync(testFiles[1], 'utf-8')).toBe('export function search() {}');
    });

    it('throws error for non-existent checkpoint', async () => {
      await expect(checkpointService.restore('nonexistent-id'))
        .rejects.toThrow(/not found/i);
    });
  });

  describe('delete', () => {
    it('removes a checkpoint from disk', async () => {
      const checkpoint = await checkpointService.create(
        testFiles,
        mockScores,
        mockIndexState
      );

      const checkpointFile = join(tempDir, 'checkpoints', `${checkpoint.id}.json`);
      expect(existsSync(checkpointFile)).toBe(true);

      await checkpointService.delete(checkpoint.id);
      expect(existsSync(checkpointFile)).toBe(false);
    });

    it('succeeds silently for non-existent checkpoint', async () => {
      await expect(checkpointService.delete('nonexistent-id')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('removes checkpoints older than specified age', async () => {
      // Create an old checkpoint by manually writing it
      const oldId = 'old-checkpoint';
      const oldCheckpoint = {
        id: oldId,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
        baselineScores: mockScores,
        files: [],
        indexState: mockIndexState,
      };
      writeFileSync(
        join(tempDir, 'checkpoints', `${oldId}.json`),
        JSON.stringify(oldCheckpoint)
      );

      // Create a new checkpoint
      await checkpointService.create(testFiles, mockScores, mockIndexState);

      // Cleanup with 1 hour max age
      await checkpointService.cleanup(60 * 60 * 1000);

      const remaining = await checkpointService.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).not.toBe(oldId);
    });
  });
});
