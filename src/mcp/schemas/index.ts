import { z } from 'zod';

/**
 * Validation schemas for all MCP tool inputs
 *
 * These schemas provide runtime type validation and better error messages
 * compared to manual type assertions.
 */

// ============================================================================
// Search Tool Schemas
// ============================================================================

/**
 * Schema for search tool arguments
 */
export const SearchArgsSchema = z.object({
  query: z.string().min(1, 'Query must be a non-empty string'),
  intent: z
    .enum([
      'find-pattern',
      'find-implementation',
      'find-usage',
      'find-definition',
      'find-documentation',
    ])
    .optional(),
  detail: z.enum(['minimal', 'contextual', 'full']).default('minimal'),
  limit: z.number().int().positive().default(10),
  stores: z.array(z.string()).optional(),
  minRelevance: z
    .number()
    .min(0, 'minRelevance must be between 0 and 1')
    .max(1, 'minRelevance must be between 0 and 1')
    .optional(),
});

export type SearchArgs = z.infer<typeof SearchArgsSchema>;

/**
 * Schema for get_full_context tool arguments
 */
export const GetFullContextArgsSchema = z.object({
  resultId: z.string().min(1, 'Result ID must be a non-empty string'),
});

export type GetFullContextArgs = z.infer<typeof GetFullContextArgsSchema>;

// ============================================================================
// Store Tool Schemas
// ============================================================================

/**
 * Schema for list_stores tool arguments
 */
export const ListStoresArgsSchema = z.object({
  type: z.enum(['file', 'repo', 'web']).optional(),
});

export type ListStoresArgs = z.infer<typeof ListStoresArgsSchema>;

/**
 * Schema for get_store_info tool arguments
 */
export const GetStoreInfoArgsSchema = z.object({
  store: z.string().min(1, 'Store name or ID must be a non-empty string'),
});

export type GetStoreInfoArgs = z.infer<typeof GetStoreInfoArgsSchema>;

/**
 * Schema for create_store tool arguments
 */
export const CreateStoreArgsSchema = z.object({
  name: z.string().min(1, 'Store name must be a non-empty string'),
  type: z.enum(['file', 'repo']),
  source: z.string().min(1, 'Source path or URL must be a non-empty string'),
  branch: z.string().optional(),
  description: z.string().optional(),
});

export type CreateStoreArgs = z.infer<typeof CreateStoreArgsSchema>;

/**
 * Schema for index_store tool arguments
 */
export const IndexStoreArgsSchema = z.object({
  store: z.string().min(1, 'Store name or ID must be a non-empty string'),
});

export type IndexStoreArgs = z.infer<typeof IndexStoreArgsSchema>;

/**
 * Schema for delete_store tool arguments
 */
export const DeleteStoreArgsSchema = z.object({
  store: z.string().min(1, 'Store name or ID must be a non-empty string'),
});

export type DeleteStoreArgs = z.infer<typeof DeleteStoreArgsSchema>;

// ============================================================================
// Job Tool Schemas
// ============================================================================

/**
 * Schema for check_job_status tool arguments
 */
export const CheckJobStatusArgsSchema = z.object({
  jobId: z.string().min(1, 'Job ID must be a non-empty string'),
});

export type CheckJobStatusArgs = z.infer<typeof CheckJobStatusArgsSchema>;

/**
 * Schema for list_jobs tool arguments
 */
export const ListJobsArgsSchema = z.object({
  activeOnly: z.boolean().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
});

export type ListJobsArgs = z.infer<typeof ListJobsArgsSchema>;

/**
 * Schema for cancel_job tool arguments
 */
export const CancelJobArgsSchema = z.object({
  jobId: z.string().min(1, 'Job ID must be a non-empty string'),
});

export type CancelJobArgs = z.infer<typeof CancelJobArgsSchema>;

// ============================================================================
// Execute Meta-Tool Schema
// ============================================================================

/**
 * Schema for execute meta-tool arguments
 *
 * The execute tool consolidates store and job management commands
 * into a single tool, reducing context overhead.
 */
export const ExecuteArgsSchema = z.object({
  command: z.string().min(1, 'Command name is required'),
  args: z.record(z.string(), z.unknown()).optional(),
});

export type ExecuteArgs = z.infer<typeof ExecuteArgsSchema>;
