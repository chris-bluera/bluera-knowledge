import { JobService } from '../../services/job.service.js';
import {
  CheckJobStatusArgsSchema,
  ListJobsArgsSchema,
  CancelJobArgsSchema,
} from '../schemas/index.js';
import type { CheckJobStatusArgs, ListJobsArgs, CancelJobArgs } from '../schemas/index.js';
import type { ToolHandler, ToolResponse } from '../types.js';

/**
 * Handle check_job_status requests
 *
 * Retrieves the current status of a background job.
 */
export const handleCheckJobStatus: ToolHandler<CheckJobStatusArgs> = (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = CheckJobStatusArgsSchema.parse(args);

  const { options } = context;

  const jobService = new JobService(options.dataDir);
  const job = jobService.getJob(validated.jobId);

  if (!job) {
    throw new Error(`Job not found: ${validated.jobId}`);
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify(job, null, 2),
      },
    ],
  });
};

/**
 * Handle list_jobs requests
 *
 * Lists all jobs with optional filtering by status or active status.
 */
export const handleListJobs: ToolHandler<ListJobsArgs> = (args, context): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = ListJobsArgsSchema.parse(args);

  const { options } = context;

  const jobService = new JobService(options.dataDir);

  let jobs;
  if (validated.activeOnly === true) {
    jobs = jobService.listActiveJobs();
  } else if (validated.status !== undefined) {
    jobs = jobService.listJobs(validated.status);
  } else {
    jobs = jobService.listJobs();
  }

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify({ jobs }, null, 2),
      },
    ],
  });
};

/**
 * Handle cancel_job requests
 *
 * Cancels a running or pending background job.
 * Kills the worker process if it exists.
 */
export const handleCancelJob: ToolHandler<CancelJobArgs> = (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = CancelJobArgsSchema.parse(args);

  const { options } = context;

  const jobService = new JobService(options.dataDir);
  const result = jobService.cancelJob(validated.jobId);

  if (!result.success) {
    throw new Error(result.error.message);
  }

  const job = jobService.getJob(validated.jobId);

  return Promise.resolve({
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            job,
            message: 'Job cancelled successfully',
          },
          null,
          2
        ),
      },
    ],
  });
};
