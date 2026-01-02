import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ToolHandler, ToolResponse } from '../types.js';
import type {
  ListStoresArgs,
  GetStoreInfoArgs,
  CreateStoreArgs,
  IndexStoreArgs,
  DeleteStoreArgs
} from '../schemas/index.js';
import {
  ListStoresArgsSchema,
  GetStoreInfoArgsSchema,
  CreateStoreArgsSchema,
  IndexStoreArgsSchema,
  DeleteStoreArgsSchema
} from '../schemas/index.js';
import { JobService } from '../../services/job.service.js';
import { spawnBackgroundWorker } from '../../workers/spawn-worker.js';
import { createStoreId } from '../../types/brands.js';

/**
 * Handle list_stores requests
 *
 * Lists all knowledge stores with optional type filtering.
 */
export const handleListStores: ToolHandler<ListStoresArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = ListStoresArgsSchema.parse(args);

  const { services } = context;

  const stores = await services.store.list();
  const filtered = validated.type !== undefined
    ? stores.filter(s => s.type === validated.type)
    : stores;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          stores: filtered.map(s => ({
            id: s.id,
            name: s.name,
            type: s.type,
            path: 'path' in s ? s.path : undefined,
            url: 'url' in s && s.url !== undefined ? s.url : undefined,
            description: s.description,
            createdAt: s.createdAt.toISOString()
          }))
        }, null, 2)
      }
    ]
  };
};

/**
 * Handle get_store_info requests
 *
 * Retrieves detailed information about a specific store.
 */
export const handleGetStoreInfo: ToolHandler<GetStoreInfoArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = GetStoreInfoArgsSchema.parse(args);

  const { services } = context;

  const store = await services.store.getByIdOrName(createStoreId(validated.store));

  if (store === undefined) {
    throw new Error(`Store not found: ${validated.store}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          id: store.id,
          name: store.name,
          type: store.type,
          path: 'path' in store ? store.path : undefined,
          url: 'url' in store && store.url !== undefined ? store.url : undefined,
          branch: 'branch' in store ? store.branch : undefined,
          description: store.description,
          status: store.status,
          createdAt: store.createdAt.toISOString(),
          updatedAt: store.updatedAt.toISOString()
        }, null, 2)
      }
    ]
  };
};

/**
 * Handle create_store requests
 *
 * Creates a new knowledge store and starts background indexing.
 * Returns store info and job ID for tracking progress.
 */
export const handleCreateStore: ToolHandler<CreateStoreArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = CreateStoreArgsSchema.parse(args);

  const { services, options } = context;

  // Determine if source is a URL or path
  const isUrl = validated.source.startsWith('http://') ||
                validated.source.startsWith('https://') ||
                validated.source.startsWith('git@');

  const result = await services.store.create({
    name: validated.name,
    type: validated.type,
    ...(isUrl ? { url: validated.source } : { path: validated.source }),
    ...(validated.branch !== undefined ? { branch: validated.branch } : {}),
    ...(validated.description !== undefined ? { description: validated.description } : {})
  });

  if (!result.success) {
    throw new Error(result.error.message);
  }

  // Create background job for indexing
  const jobService = new JobService(options.dataDir);
  const jobDetails: Record<string, unknown> = {
    storeName: result.data.name,
    storeId: result.data.id
  };
  if (isUrl) {
    jobDetails['url'] = validated.source;
  }
  if ('path' in result.data && result.data.path) {
    jobDetails['path'] = result.data.path;
  }
  const job = jobService.createJob({
    type: validated.type === 'repo' && isUrl ? 'clone' : 'index',
    details: jobDetails,
    message: `Indexing ${result.data.name}...`
  });

  // Spawn background worker (dataDir defaults to project-local .bluera if undefined)
  spawnBackgroundWorker(job.id, options.dataDir ?? '');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          store: {
            id: result.data.id,
            name: result.data.name,
            type: result.data.type,
            path: 'path' in result.data ? result.data.path : undefined
          },
          job: {
            id: job.id,
            status: job.status,
            message: job.message
          },
          message: `Store created. Indexing started in background (Job ID: ${job.id})`
        }, null, 2)
      }
    ]
  };
};

/**
 * Handle index_store requests
 *
 * Re-indexes an existing store in the background.
 * Returns job ID for tracking progress.
 */
export const handleIndexStore: ToolHandler<IndexStoreArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = IndexStoreArgsSchema.parse(args);

  const { services, options } = context;

  const store = await services.store.getByIdOrName(createStoreId(validated.store));

  if (store === undefined) {
    throw new Error(`Store not found: ${validated.store}`);
  }

  // Create background job for indexing
  const jobService = new JobService(options.dataDir);
  const jobDetails: Record<string, unknown> = {
    storeName: store.name,
    storeId: store.id
  };
  if ('path' in store && store.path) {
    jobDetails['path'] = store.path;
  }
  const job = jobService.createJob({
    type: 'index',
    details: jobDetails,
    message: `Re-indexing ${store.name}...`
  });

  // Spawn background worker (dataDir defaults to project-local .bluera if undefined)
  spawnBackgroundWorker(job.id, options.dataDir ?? '');

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          store: {
            id: store.id,
            name: store.name
          },
          job: {
            id: job.id,
            status: job.status,
            message: job.message
          },
          message: `Indexing started in background (Job ID: ${job.id})`
        }, null, 2)
      }
    ]
  };
};

/**
 * Handle delete_store requests
 *
 * Deletes a store and all associated data:
 * - Removes from store registry
 * - Drops LanceDB table
 * - For repo stores with URL, removes cloned files
 */
export const handleDeleteStore: ToolHandler<DeleteStoreArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = DeleteStoreArgsSchema.parse(args);

  const { services, options } = context;

  const store = await services.store.getByIdOrName(createStoreId(validated.store));

  if (store === undefined) {
    throw new Error(`Store not found: ${validated.store}`);
  }

  // Delete LanceDB table
  await services.lance.deleteStore(store.id);

  // For repo stores cloned from URL, remove the cloned directory
  if (store.type === 'repo' && 'url' in store && store.url !== undefined) {
    if (options.dataDir === undefined) {
      throw new Error('dataDir is required to delete cloned repository files');
    }
    const repoPath = join(options.dataDir, 'repos', store.id);
    await rm(repoPath, { recursive: true, force: true });
  }

  // Delete from registry
  const result = await services.store.delete(store.id);
  if (!result.success) {
    throw new Error(result.error.message);
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          deleted: true,
          store: {
            id: store.id,
            name: store.name,
            type: store.type
          },
          message: `Successfully deleted store: ${store.name}`
        }, null, 2)
      }
    ]
  };
};
