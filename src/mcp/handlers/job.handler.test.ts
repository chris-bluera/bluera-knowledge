import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleCheckJobStatus, handleListJobs, handleCancelJob } from './job.handler.js';
import type { HandlerContext } from '../types.js';
import type { CheckJobStatusArgs, ListJobsArgs, CancelJobArgs } from '../schemas/index.js';
import { JobService } from '../../services/job.service.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('job.handler', () => {
  let tempDir: string;
  let mockContext: HandlerContext;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'job-handler-test-'));
    mockContext = {
      services: {} as any,
      options: { dataDir: tempDir },
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('handleCheckJobStatus', () => {
    it('should return job status', async () => {
      const jobService = new JobService(tempDir);
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test-store' },
        message: 'Indexing...',
      });

      const args: CheckJobStatusArgs = { jobId: job.id };
      const result = await handleCheckJobStatus(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe(job.id);
      expect(data.status).toBe('pending');
    });

    it('should throw if job not found', async () => {
      const args: CheckJobStatusArgs = { jobId: 'nonexistent' };

      try {
        await handleCheckJobStatus(args, mockContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Job not found: nonexistent');
      }
    });

    it('should validate arguments with Zod', async () => {
      const invalidArgs = { jobId: 123 } as any;

      try {
        await handleCheckJobStatus(invalidArgs, mockContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('handleListJobs', () => {
    it('should list all jobs', async () => {
      const jobService = new JobService(tempDir);
      jobService.createJob({
        type: 'index',
        details: { storeId: 'store1' },
        message: 'Indexing store1',
      });
      jobService.createJob({
        type: 'clone',
        details: { url: 'https://example.com' },
        message: 'Cloning repo',
      });

      const args: ListJobsArgs = {};
      const result = await handleListJobs(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.jobs).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const jobService = new JobService(tempDir);
      const job1 = jobService.createJob({
        type: 'index',
        details: { storeId: 'store1' },
        message: 'Indexing',
      });
      jobService.createJob({
        type: 'clone',
        details: { url: 'https://example.com' },
        message: 'Cloning',
      });

      // Update job1 status
      jobService.updateJob(job1.id, { status: 'completed' });

      const args: ListJobsArgs = { status: 'completed' };
      const result = await handleListJobs(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].status).toBe('completed');
    });

    it('should filter active jobs only', async () => {
      const jobService = new JobService(tempDir);
      const job1 = jobService.createJob({
        type: 'index',
        details: { storeId: 'store1' },
        message: 'Indexing',
      });
      jobService.createJob({
        type: 'clone',
        details: { url: 'https://example.com' },
        message: 'Cloning',
      });

      jobService.updateJob(job1.id, { status: 'completed' });

      const args: ListJobsArgs = { activeOnly: true };
      const result = await handleListJobs(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].status).not.toBe('completed');
    });
  });

  describe('handleCancelJob', () => {
    it('should cancel a pending job', async () => {
      const jobService = new JobService(tempDir);
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test-store' },
        message: 'Indexing...',
      });

      const args: CancelJobArgs = { jobId: job.id };
      const result = await handleCancelJob(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.job.status).toBe('cancelled');
    });

    it('should throw if job not found', async () => {
      const args: CancelJobArgs = { jobId: 'nonexistent' };

      try {
        await handleCancelJob(args, mockContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Job nonexistent not found');
      }
    });

    it('should throw if job already completed', async () => {
      const jobService = new JobService(tempDir);
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test-store' },
        message: 'Indexing...',
      });

      jobService.updateJob(job.id, { status: 'completed' });

      const args: CancelJobArgs = { jobId: job.id };

      try {
        await handleCancelJob(args, mockContext);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Cannot cancel completed job');
      }
    });
  });
});
