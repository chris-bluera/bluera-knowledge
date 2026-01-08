import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobService } from './job.service.js';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('JobService', () => {
  let tempDir: string;
  let jobService: JobService;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'job-service-test-'));
    jobService = new JobService(tempDir);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create jobs directory', () => {
      const jobsDir = join(tempDir, 'jobs');
      expect(existsSync(jobsDir)).toBe(true);
    });
  });

  describe('createJob', () => {
    it('should create a job with required fields', () => {
      const job = jobService.createJob({
        type: 'clone',
        details: { storeId: 'test-store', url: 'https://github.com/test/repo' },
      });

      expect(job.id).toMatch(/^job_[a-f0-9]{12}$/);
      expect(job.type).toBe('clone');
      expect(job.status).toBe('pending');
      expect(job.progress).toBe(0);
      expect(job.details.storeId).toBe('test-store');
      expect(job.createdAt).toBeDefined();
      expect(job.updatedAt).toBeDefined();
    });

    it('should persist job to file', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      expect(existsSync(jobFile)).toBe(true);
    });
  });

  describe('updateJob', () => {
    it('should update job status and progress', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      jobService.updateJob(job.id, {
        status: 'running',
        progress: 50,
        message: 'Processing files...',
      });

      const updated = jobService.getJob(job.id);
      expect(updated?.status).toBe('running');
      expect(updated?.progress).toBe(50);
      expect(updated?.message).toBe('Processing files...');
    });

    it('should merge job details', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test', filesProcessed: 10 },
      });

      jobService.updateJob(job.id, {
        details: { totalFiles: 100 },
      });

      const updated = jobService.getJob(job.id);
      expect(updated?.details.storeId).toBe('test');
      expect(updated?.details.filesProcessed).toBe(10);
      expect(updated?.details.totalFiles).toBe(100);
    });

    it('should throw error for non-existent job', () => {
      expect(() => {
        jobService.updateJob('non-existent-job', { status: 'running' });
      }).toThrow('Job non-existent-job not found');
    });
  });

  describe('getJob', () => {
    it('should retrieve job by ID', () => {
      const job = jobService.createJob({
        type: 'clone',
        details: { storeId: 'test' },
      });

      const retrieved = jobService.getJob(job.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should return null for non-existent job', () => {
      const job = jobService.getJob('non-existent-job');
      expect(job).toBeNull();
    });
  });

  describe('listJobs', () => {
    beforeEach(() => {
      jobService.createJob({ type: 'clone', details: { storeId: 'test1' } });
      const job2 = jobService.createJob({ type: 'index', details: { storeId: 'test2' } });
      jobService.updateJob(job2.id, { status: 'running' });
      const job3 = jobService.createJob({ type: 'index', details: { storeId: 'test3' } });
      jobService.updateJob(job3.id, { status: 'completed' });
    });

    it('should list all jobs without filter', () => {
      const jobs = jobService.listJobs();
      expect(jobs.length).toBe(3);
    });

    it('should filter jobs by status', () => {
      const pendingJobs = jobService.listJobs('pending');
      expect(pendingJobs.length).toBe(1);
      expect(pendingJobs[0]?.status).toBe('pending');
    });

    it('should filter jobs by multiple statuses', () => {
      const activeJobs = jobService.listJobs(['pending', 'running']);
      expect(activeJobs.length).toBe(2);
    });

    it('should skip corrupted job files', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a corrupted job file
      const jobFile = join(tempDir, 'jobs', 'corrupted.json');
      writeFileSync(jobFile, 'invalid json{{{', 'utf-8');

      const jobs = jobService.listJobs();
      expect(jobs.length).toBe(3); // Should skip corrupted file

      consoleErrorSpy.mockRestore();
    });

    it('should skip non-JSON files', () => {
      const txtFile = join(tempDir, 'jobs', 'readme.txt');
      writeFileSync(txtFile, 'some text', 'utf-8');

      const jobs = jobService.listJobs();
      expect(jobs.length).toBe(3); // Should skip .txt file
    });

    it('should skip .pid files', () => {
      const pidFile = join(tempDir, 'jobs', 'job_123.pid');
      writeFileSync(pidFile, '12345', 'utf-8');

      const jobs = jobService.listJobs();
      expect(jobs.length).toBe(3); // Should skip .pid file
    });

    it('should return empty array if jobs directory does not exist', () => {
      const emptyService = new JobService(join(tempDir, 'nonexistent'));
      rmSync(join(tempDir, 'nonexistent'), { recursive: true, force: true });

      const jobs = emptyService.listJobs();
      expect(jobs).toEqual([]);
    });
  });

  describe('listActiveJobs', () => {
    it('should return only pending and running jobs', () => {
      jobService.createJob({ type: 'clone', details: { storeId: 'test1' } });
      const job2 = jobService.createJob({ type: 'index', details: { storeId: 'test2' } });
      jobService.updateJob(job2.id, { status: 'running' });
      const job3 = jobService.createJob({ type: 'index', details: { storeId: 'test3' } });
      jobService.updateJob(job3.id, { status: 'completed' });

      const activeJobs = jobService.listActiveJobs();
      expect(activeJobs.length).toBe(2);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);

      const updated = jobService.getJob(job.id);
      expect(updated?.status).toBe('cancelled');
    });

    it('should return error for non-existent job', () => {
      const result = jobService.cancelJob('non-existent');
      expect(result.success).toBe(false);
    });

    it('should return error for completed job', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'completed' });

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(false);
    });

    it('should return error for failed job', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'failed' });

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(false);
    });

    it('should succeed if job already cancelled', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.cancelJob(job.id);

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('should remove PID file if exists', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      // Create a PID file with a non-existent process ID (NOT our own PID - that would kill the test runner!)
      const pidFile = join(tempDir, 'jobs', `${job.id}.pid`);
      writeFileSync(pidFile, '999999999', 'utf-8');

      jobService.cancelJob(job.id);

      expect(existsSync(pidFile)).toBe(false);
    });

    it('should handle missing PID file gracefully', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('should handle invalid PID gracefully', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      // Create PID file with non-existent process ID
      const pidFile = join(tempDir, 'jobs', `${job.id}.pid`);
      writeFileSync(pidFile, '999999', 'utf-8');

      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });
  });

  describe('cleanupOldJobs', () => {
    it('should clean up old completed jobs', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'completed' });

      // Make it old
      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
      jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(1);
      expect(existsSync(jobFile)).toBe(false);
    });

    it('should clean up old failed jobs', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'failed' });

      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
      jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(1);
    });

    it('should clean up old cancelled jobs', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'cancelled' });

      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
      jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(1);
    });

    it('should not clean up recent jobs', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'completed' });

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(0);
    });

    it('should not clean up active jobs', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'running' });

      // Make it old
      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
      jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(0);
    });

    it('should use default 24 hours if not specified', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });
      jobService.updateJob(job.id, { status: 'completed' });

      const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
      const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
      jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');

      const cleaned = jobService.cleanupOldJobs();
      expect(cleaned).toBe(1);
    });

    it('should return count of cleaned jobs', () => {
      const job1 = jobService.createJob({ type: 'index', details: { storeId: 'test1' } });
      jobService.updateJob(job1.id, { status: 'completed' });

      const job2 = jobService.createJob({ type: 'index', details: { storeId: 'test2' } });
      jobService.updateJob(job2.id, { status: 'failed' });

      // Make both old
      [job1, job2].forEach((job) => {
        const jobFile = join(tempDir, 'jobs', `${job.id}.json`);
        const jobData = JSON.parse(readFileSync(jobFile, 'utf-8'));
        jobData.updatedAt = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        writeFileSync(jobFile, JSON.stringify(jobData), 'utf-8');
      });

      const cleaned = jobService.cleanupOldJobs(24);
      expect(cleaned).toBe(2);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job file', () => {
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test' },
      });

      const deleted = jobService.deleteJob(job.id);
      expect(deleted).toBe(true);

      const retrieved = jobService.getJob(job.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent job', () => {
      const deleted = jobService.deleteJob('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
