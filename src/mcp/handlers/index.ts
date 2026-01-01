import { z } from 'zod';
import type { ToolHandler } from '../types.js';
import {
  SearchArgsSchema,
  GetFullContextArgsSchema,
  ListStoresArgsSchema,
  GetStoreInfoArgsSchema,
  CreateStoreArgsSchema,
  IndexStoreArgsSchema,
  DeleteStoreArgsSchema,
  CheckJobStatusArgsSchema,
  ListJobsArgsSchema,
  CancelJobArgsSchema
} from '../schemas/index.js';
import {
  handleSearch,
  handleGetFullContext
} from './search.handler.js';
import {
  handleListStores,
  handleGetStoreInfo,
  handleCreateStore,
  handleIndexStore,
  handleDeleteStore
} from './store.handler.js';
import {
  handleCheckJobStatus,
  handleListJobs,
  handleCancelJob
} from './job.handler.js';

/**
 * Tool definition with schema and handler
 */
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: ToolHandler<any>;
}

/**
 * Registry of all MCP tools
 *
 * Each tool has a name, description, Zod validation schema, and handler function.
 * This registry is used by the server to route requests to the appropriate handler.
 */
export const tools: ToolDefinition[] = [
  // Search tools
  {
    name: 'search',
    description: 'Search all indexed knowledge stores with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.',
    schema: SearchArgsSchema,
    handler: handleSearch
  },
  {
    name: 'get_full_context',
    description: 'Get complete code and context for a specific search result by ID. Use this after search to get full implementation details.',
    schema: GetFullContextArgsSchema,
    handler: handleGetFullContext
  },

  // Store tools
  {
    name: 'list_stores',
    description: 'List all indexed knowledge stores (library sources, reference material, documentation)',
    schema: ListStoresArgsSchema,
    handler: handleListStores
  },
  {
    name: 'get_store_info',
    description: 'Get detailed information about a specific store including its file path for direct access',
    schema: GetStoreInfoArgsSchema,
    handler: handleGetStoreInfo
  },
  {
    name: 'create_store',
    description: 'Create a new knowledge store from git URL or local path',
    schema: CreateStoreArgsSchema,
    handler: handleCreateStore
  },
  {
    name: 'index_store',
    description: 'Index or re-index a knowledge store to make it searchable',
    schema: IndexStoreArgsSchema,
    handler: handleIndexStore
  },
  {
    name: 'delete_store',
    description: 'Delete a knowledge store and all associated data (database, cloned files)',
    schema: DeleteStoreArgsSchema,
    handler: handleDeleteStore
  },

  // Job tools
  {
    name: 'check_job_status',
    description: 'Check the status of a background job (clone, index, crawl operations)',
    schema: CheckJobStatusArgsSchema,
    handler: handleCheckJobStatus
  },
  {
    name: 'list_jobs',
    description: 'List all background jobs, optionally filtered by status',
    schema: ListJobsArgsSchema,
    handler: handleListJobs
  },
  {
    name: 'cancel_job',
    description: 'Cancel a running or pending background job',
    schema: CancelJobArgsSchema,
    handler: handleCancelJob
  }
];
