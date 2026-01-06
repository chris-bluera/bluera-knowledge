import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobService } from '../../src/services/job.service.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('JobService', () => {
  let jobService: JobService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-service-test-'));
    jobService = new JobService(tempDir);
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('cancelJob', () => {
    it('handles invalid PID in PID file gracefully', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write an invalid PID to the PID file
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, 'not-a-number', 'utf-8');

      // Cancel should succeed without throwing
      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);

      // Job should be marked as cancelled
      const cancelled = jobService.getJob(job.id);
      expect(cancelled?.status).toBe('cancelled');
    });

    it('handles NaN PID gracefully', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write NaN-producing content to PID file
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, '', 'utf-8');

      // Cancel should succeed without throwing
      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('handles negative PID gracefully', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write negative PID to file (invalid)
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, '-1', 'utf-8');

      // Cancel should succeed without throwing
      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('handles zero PID gracefully', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write zero PID to file (invalid - would kill current process group)
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, '0', 'utf-8');

      // Cancel should succeed without throwing or killing process group
      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('handles non-existent process gracefully', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write a PID that almost certainly doesn't exist
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, '999999999', 'utf-8');

      // Cancel should succeed without throwing
      const result = jobService.cancelJob(job.id);
      expect(result.success).toBe(true);
    });

    it('cleans up PID file after cancel', () => {
      // Create a job
      const job = jobService.createJob({
        type: 'index',
        message: 'Test job',
      });

      // Write a valid-looking PID
      const pidFile = path.join(tempDir, 'jobs', `${job.id}.pid`);
      fs.writeFileSync(pidFile, '12345', 'utf-8');

      // Cancel the job
      jobService.cancelJob(job.id);

      // PID file should be deleted
      expect(fs.existsSync(pidFile)).toBe(false);
    });
  });
});
