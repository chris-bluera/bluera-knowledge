import fs from 'fs';
import path from 'path';

/**
 * Result of a PID file delete operation.
 * Delete operations are best-effort and should not throw.
 */
export interface PidFileResult {
  success: boolean;
  error?: Error;
}

/**
 * Context for PID file deletion - indicates when the delete is happening.
 * Used for logging/debugging purposes.
 */
export type PidFileDeleteContext = 'sigterm' | 'success' | 'failure';

/**
 * Write PID file - CRITICAL operation that must succeed.
 *
 * If the PID file cannot be written, the job cannot be cancelled through
 * the job management system. This is a critical failure and the job
 * should not proceed.
 *
 * @param pidFile - Absolute path to the PID file
 * @param pid - Process ID to write
 * @throws Error if PID file cannot be written
 */
export function writePidFile(pidFile: string, pid: number): void {
  try {
    fs.writeFileSync(pidFile, pid.toString(), 'utf-8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `CRITICAL: Failed to write PID file ${pidFile}. ` +
        `Job cannot be cancelled without PID file. ` +
        `Original error: ${message}`
    );
  }
}

/**
 * Delete PID file - best-effort cleanup during shutdown.
 *
 * This operation should NEVER throw. During process shutdown (SIGTERM,
 * job success, job failure), failing to delete a PID file should not
 * prevent the process from exiting cleanly.
 *
 * Stale PID files are cleaned up by JobService.cleanupOldJobs().
 *
 * @param pidFile - Absolute path to the PID file
 * @param _context - Context indicating when the delete is happening (for future logging)
 * @returns Result indicating success or failure with error details
 */
export function deletePidFile(pidFile: string, _context: PidFileDeleteContext): PidFileResult {
  try {
    fs.unlinkSync(pidFile);
    return { success: true };
  } catch (error) {
    // ENOENT = file doesn't exist - that's success (nothing to delete)
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { success: true };
    }
    // Any other error = failure (permission denied, etc.)
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Build the path to a PID file for a given job.
 *
 * @param jobsDir - Directory where job files are stored
 * @param jobId - Job identifier
 * @returns Absolute path to the PID file
 */
export function buildPidFilePath(jobsDir: string, jobId: string): string {
  return path.join(jobsDir, `${jobId}.pid`);
}
