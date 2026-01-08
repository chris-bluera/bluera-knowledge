import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Spawn a background worker process to execute a job
 *
 * The worker runs detached from the parent process, allowing the
 * parent to exit while the worker continues running.
 *
 * @param jobId - The ID of the job to execute
 */
export function spawnBackgroundWorker(jobId: string, dataDir: string): void {
  // Determine the worker script path
  // In production, this will be the compiled dist file
  // In development, we need to use tsx to run TypeScript
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Check if we're running from dist (production) or src (development)
  const isProduction = __dirname.includes('/dist/');

  let command: string;
  let args: string[];

  if (isProduction) {
    // Production: Use Node.js directly with compiled file
    const workerScript = path.join(__dirname, 'background-worker-cli.js');
    command = process.execPath; // Use the same Node.js binary
    args = [workerScript, jobId];
  } else {
    // Development: Use tsx to run TypeScript directly
    const workerScript = path.join(__dirname, 'background-worker-cli.ts');
    command = 'npx';
    args = ['tsx', workerScript, jobId];
  }

  // Spawn the worker process
  const worker = spawn(command, args, {
    detached: true, // Detach from parent process
    stdio: 'ignore', // Don't pipe stdio (fully independent)
    env: {
      ...process.env, // Inherit environment variables
      BLUERA_DATA_DIR: dataDir, // Pass dataDir to worker
    },
  });

  // Unref the worker so the parent can exit
  worker.unref();
}
