#!/usr/bin/env node
import { BackgroundWorker } from './background-worker.js';
import { writePidFile, deletePidFile, buildPidFilePath } from './pid-file.js';
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

  // Write PID file for job cancellation - CRITICAL: must succeed or job cannot be cancelled
  const pidFile = buildPidFilePath(
    jobService['jobsDir'], // Access private field for PID path
    jobId
  );

  try {
    writePidFile(pidFile, process.pid);
  } catch (error) {
    // CRITICAL: Cannot proceed without PID file - job would be uncancellable
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Handle SIGTERM for graceful shutdown
  process.on('SIGTERM', () => {
    console.log(`[${jobId}] Received SIGTERM, cancelling job...`);
    jobService.updateJob(jobId, {
      status: 'cancelled',
      message: 'Job cancelled by user',
    });

    // Clean up PID file (best-effort - don't block shutdown)
    const deleteResult = deletePidFile(pidFile, 'sigterm');
    if (!deleteResult.success && deleteResult.error !== undefined) {
      console.error(
        `Warning: Could not remove PID file during SIGTERM: ${deleteResult.error.message}`
      );
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

    // Clean up PID file on success (best-effort - don't change exit code)
    const successCleanup = deletePidFile(pidFile, 'success');
    if (!successCleanup.success && successCleanup.error !== undefined) {
      console.error(
        `Warning: Could not remove PID file after success: ${successCleanup.error.message}`
      );
    }

    console.log(`[${jobId}] Job completed successfully`);
    process.exit(0);
  } catch (error) {
    // Job service already updated with failure status in BackgroundWorker
    console.error(`[${jobId}] Job failed:`, error);

    // Clean up PID file on failure (best-effort - exit code reflects job failure)
    const failureCleanup = deletePidFile(pidFile, 'failure');
    if (!failureCleanup.success && failureCleanup.error !== undefined) {
      console.error(
        `Warning: Could not remove PID file after failure: ${failureCleanup.error.message}`
      );
    }

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error in background worker:', error);
  process.exit(1);
});
