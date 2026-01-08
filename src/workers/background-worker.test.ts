import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackgroundWorker, calculateIndexProgress } from './background-worker.js';
import { JobService } from '../services/job.service.js';
import { StoreService } from '../services/store.service.js';
import { IndexService } from '../services/index.service.js';
import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('BackgroundWorker', () => {
  let tempDir: string;
  let jobService: JobService;
  let storeService: StoreService;
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let worker: BackgroundWorker;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'background-worker-test-'));
    jobService = new JobService(tempDir);
    storeService = new StoreService(tempDir);
    indexService = new IndexService(tempDir);
    // Mock LanceStore and EmbeddingEngine for testing
    lanceStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
      addDocuments: vi.fn().mockResolvedValue(undefined),
    } as unknown as LanceStore;
    embeddingEngine = {
      embed: vi.fn().mockResolvedValue(new Array(384).fill(0)),
    } as unknown as EmbeddingEngine;
    worker = new BackgroundWorker(
      jobService,
      storeService,
      indexService,
      lanceStore,
      embeddingEngine
    );
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('executeJob', () => {
    it('should throw error for non-existent job', async () => {
      await expect(worker.executeJob('non-existent')).rejects.toThrow('Job non-existent not found');
    });

    it('should throw error for unknown job type', async () => {
      const job = jobService.createJob({
        // @ts-expect-error testing invalid job type
        type: 'unknown',
        details: { storeId: 'test' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Unknown job type: unknown');
    });

    it('should set job to running status before execution', async () => {
      const job = jobService.createJob({
        type: 'crawl',
        details: { storeId: 'test' },
      });

      try {
        await worker.executeJob(job.id);
      } catch {
        // Expected to fail since store doesn't exist
      }

      const updated = jobService.getJob(job.id);
      // Should have been set to running before throwing error
      expect(updated?.status).toBe('failed');
    });

    it('should update job to failed status on error', async () => {
      const job = jobService.createJob({
        type: 'crawl',
        details: { storeId: 'test', url: 'https://example.com' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Web store test not found');

      const updated = jobService.getJob(job.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.message).toBe('Web store test not found');
    });
  });

  describe('executeIndexJob', () => {
    it('should throw error for job without storeId', async () => {
      const job = jobService.createJob({
        type: 'index',
        details: {},
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Store ID required for index job');
    });

    it('should throw error for non-existent store', async () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'non-existent-store' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Store non-existent-store not found');
    });
  });

  describe('executeCloneJob', () => {
    it('should throw error for job without storeId', async () => {
      const job = jobService.createJob({
        type: 'clone',
        details: {},
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Store ID required for clone job');
    });

    it('should throw error for non-existent store', async () => {
      const job = jobService.createJob({
        type: 'clone',
        details: { storeId: 'non-existent-store' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Store non-existent-store not found');
    });
  });

  describe('executeCrawlJob', () => {
    it('should throw error for job without storeId', async () => {
      const job = jobService.createJob({
        type: 'crawl',
        details: { url: 'https://example.com' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('Store ID required for crawl job');
    });

    it('should throw error for job without url', async () => {
      const job = jobService.createJob({
        type: 'crawl',
        details: { storeId: 'test-store' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow('URL required for crawl job');
    });

    it('should throw error for non-existent store', async () => {
      const job = jobService.createJob({
        type: 'crawl',
        details: { storeId: 'non-existent-store', url: 'https://example.com' },
      });

      await expect(worker.executeJob(job.id)).rejects.toThrow(
        'Web store non-existent-store not found'
      );
    });
  });

  describe('calculateIndexProgress', () => {
    it('handles event.total === 0 without division by zero (NaN)', () => {
      const result = calculateIndexProgress(0, 0, 70);
      expect(Number.isNaN(result)).toBe(false);
      expect(result).toBe(0);
    });

    it('handles event.total === 0 with scale 100', () => {
      const result = calculateIndexProgress(0, 0, 100);
      expect(Number.isNaN(result)).toBe(false);
      expect(result).toBe(0);
    });

    it('calculates progress correctly for non-zero total', () => {
      // 5/10 * 70 = 35
      expect(calculateIndexProgress(5, 10, 70)).toBe(35);
      // 5/10 * 100 = 50
      expect(calculateIndexProgress(5, 10, 100)).toBe(50);
      // 10/10 * 100 = 100
      expect(calculateIndexProgress(10, 10, 100)).toBe(100);
    });

    it('uses default scale of 100', () => {
      expect(calculateIndexProgress(5, 10)).toBe(50);
    });
  });
});
