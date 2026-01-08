#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { BackgroundWorker } from './background-worker.js';
import { createServices } from '../services/index.js';
import { JobService } from '../services/job.service.js';

/**
 * Background worker CLI entry point
 *
 * Usage: background-worker-cli <job-id>
 *
 * This process runs detached from the parent and executes a single job.
 */

async function main(): Promise<void> {
  const jobId = process.argv[2];
  const dataDir = process.env['BLUERA_DATA_DIR'];

  if (jobId === undefined || jobId === '') {
    console.error('Error: Job ID required');
    console.error('Usage: background-worker-cli <job-id>');
    process.exit(1);
  }

  // Initialize services
  const jobService = new JobService(dataDir);
  const services = await createServices(undefined, dataDir);

  // Write PID file for job cancellation
  const pidFile = path.join(
    jobService['jobsDir'], // Access private field for PID path
    `${jobId}.pid`
  );

  try {
    fs.writeFileSync(pidFile, process.pid.toString(), 'utf-8');
  } catch (error) {
    console.error('Warning: Could not write PID file:', error);
  }

  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    console.log(`[${jobId}] Received SIGTERM, cancelling job...`);
    jobService.updateJob(jobId, {
      status: 'cancelled',
      message: 'Job cancelled by user',
    });

    // Clean up PID file
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch (error) {
      console.error('Warning: Could not remove PID file:', error);
    }

    process.exit(0);
  });

  // Create worker and execute job
  const worker = new BackgroundWorker(
    jobService,
    services.store,
    services.index,
    services.lance,
    services.embeddings
  );

  try {
    await worker.executeJob(jobId);

    // Clean up PID file on success
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch (error) {
      console.error('Warning: Could not remove PID file:', error);
    }

    console.log(`[${jobId}] Job completed successfully`);
    process.exit(0);
  } catch (error) {
    // Job service already updated with failure status in BackgroundWorker
    console.error(`[${jobId}] Job failed:`, error);

    // Clean up PID file on failure
    try {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    } catch (cleanupError) {
      console.error('Warning: Could not remove PID file:', cleanupError);
    }

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error in background worker:', error);
  process.exit(1);
});
