import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Result, ok, err } from '../types/result.js';
import type { Job, CreateJobParams, UpdateJobParams, JobStatus } from '../types/job.js';

export class JobService {
  private readonly jobsDir: string;

  constructor(dataDir?: string) {
    // Default to ~/.local/share/bluera-knowledge/jobs
    const baseDir =
      dataDir ??
      path.join(
        process.env['HOME'] ?? process.env['USERPROFILE'] ?? '.',
        '.local/share/bluera-knowledge'
      );
    this.jobsDir = path.join(baseDir, 'jobs');

    // Ensure jobs directory exists
    if (!fs.existsSync(this.jobsDir)) {
      fs.mkdirSync(this.jobsDir, { recursive: true });
    }
  }

  /**
   * Create a new job
   */
  createJob(params: CreateJobParams): Job {
    const job: Job = {
      id: `job_${randomUUID().replace(/-/g, '').substring(0, 12)}`,
      type: params.type,
      status: 'pending',
      progress: 0,
      message: params.message ?? `${params.type} job created`,
      details: params.details,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Write job to file
    this.writeJob(job);

    return job;
  }

  /**
   * Update an existing job
   */
  updateJob(jobId: string, updates: UpdateJobParams): void {
    const job = this.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Merge updates
    if (updates.status !== undefined) {
      job.status = updates.status;
    }
    if (updates.progress !== undefined) {
      job.progress = updates.progress;
    }
    if (updates.message !== undefined) {
      job.message = updates.message;
    }
    if (updates.details !== undefined) {
      job.details = { ...job.details, ...updates.details };
    }

    job.updatedAt = new Date().toISOString();

    // Write updated job
    this.writeJob(job);
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): Job | null {
    const jobFile = path.join(this.jobsDir, `${jobId}.json`);

    if (!fs.existsSync(jobFile)) {
      return null;
    }

    try {
      const content = fs.readFileSync(jobFile, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      return JSON.parse(content) as Job;
    } catch (error) {
      console.error(`Error reading job ${jobId}:`, error);
      return null;
    }
  }

  /**
   * List all jobs with optional status filter
   */
  listJobs(statusFilter?: JobStatus | JobStatus[]): Job[] {
    if (!fs.existsSync(this.jobsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.jobsDir);
    const jobs: Job[] = [];

    for (const file of files) {
      if (!file.endsWith('.json') || file.endsWith('.pid')) {
        continue;
      }

      try {
        const content = fs.readFileSync(path.join(this.jobsDir, file), 'utf-8');
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const job = JSON.parse(content) as Job;

        if (statusFilter !== undefined) {
          const filters = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
          if (filters.includes(job.status)) {
            jobs.push(job);
          }
        } else {
          jobs.push(job);
        }
      } catch (error) {
        console.error(`Error reading job file ${file}:`, error);
      }
    }

    // Sort by updated time (most recent first)
    jobs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return jobs;
  }

  /**
   * List active jobs (pending or running)
   */
  listActiveJobs(): Job[] {
    return this.listJobs(['pending', 'running']);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): Result<void> {
    const job = this.getJob(jobId);

    if (!job) {
      return err(new Error(`Job ${jobId} not found`));
    }

    if (job.status === 'completed' || job.status === 'failed') {
      return err(new Error(`Cannot cancel ${job.status} job`));
    }

    if (job.status === 'cancelled') {
      return ok(undefined);
    }

    // Update job status
    this.updateJob(jobId, {
      status: 'cancelled',
      message: 'Job cancelled by user',
      details: { cancelledAt: new Date().toISOString() },
    });

    // Kill worker process if it exists
    const pidFile = path.join(this.jobsDir, `${jobId}.pid`);
    if (fs.existsSync(pidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'), 10);
        // Validate PID: must be positive integer > 0
        // PID 0 = sends to process group (DANGEROUS - kills terminal!)
        // Negative PIDs have special meanings in kill()
        if (!Number.isNaN(pid) && Number.isInteger(pid) && pid > 0) {
          process.kill(pid, 'SIGTERM');
        }
      } catch {
        // Process may have already exited, ignore
      }
      // Always delete the PID file, even if kill failed
      try {
        fs.unlinkSync(pidFile);
      } catch {
        // Ignore if file already deleted
      }
    }

    return ok(undefined);
  }

  /**
   * Clean up old completed/failed/cancelled jobs
   */
  cleanupOldJobs(olderThanHours: number = 24): number {
    const jobs = this.listJobs();
    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000;
    let cleaned = 0;

    for (const job of jobs) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        new Date(job.updatedAt).getTime() < cutoffTime
      ) {
        const jobFile = path.join(this.jobsDir, `${job.id}.json`);
        try {
          fs.unlinkSync(jobFile);
          cleaned++;
        } catch (error) {
          console.error(`Error deleting job file ${job.id}:`, error);
        }
      }
    }

    return cleaned;
  }

  /**
   * Delete a specific job
   */
  deleteJob(jobId: string): boolean {
    const jobFile = path.join(this.jobsDir, `${jobId}.json`);

    if (!fs.existsSync(jobFile)) {
      return false;
    }

    try {
      fs.unlinkSync(jobFile);
      return true;
    } catch (error) {
      console.error(`Error deleting job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Write job to file
   */
  private writeJob(job: Job): void {
    const jobFile = path.join(this.jobsDir, `${job.id}.json`);
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf-8');
  }
}
