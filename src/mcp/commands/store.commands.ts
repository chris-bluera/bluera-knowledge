import { z } from 'zod';
import {
  handleListStores,
  handleGetStoreInfo,
  handleCreateStore,
  handleIndexStore,
  handleDeleteStore,
} from '../handlers/store.handler.js';
import type { CommandDefinition } from './registry.js';
import type {
  ListStoresArgs,
  GetStoreInfoArgs,
  CreateStoreArgs,
  IndexStoreArgs,
  DeleteStoreArgs,
} from '../schemas/index.js';

/**
 * Store management commands for the execute meta-tool
 *
 * These commands wrap the existing store handlers, providing
 * a unified interface through the execute command.
 *
 * Note: Type assertions are necessary here because CommandHandler uses
 * Record<string, unknown> for generic command args, while handlers expect
 * specific typed args. Zod validates at runtime before the cast.
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions */
export const storeCommands: CommandDefinition[] = [
  {
    name: 'stores',
    description: 'List all indexed knowledge stores',
    argsSchema: z.object({
      type: z.enum(['file', 'repo', 'web']).optional().describe('Filter by store type'),
    }),
    handler: (args, context) => handleListStores(args as unknown as ListStoresArgs, context),
  },
  {
    name: 'store:info',
    description: 'Get detailed information about a specific store',
    argsSchema: z.object({
      store: z.string().min(1).describe('Store name or ID'),
    }),
    handler: (args, context) => handleGetStoreInfo(args as unknown as GetStoreInfoArgs, context),
  },
  {
    name: 'store:create',
    description: 'Create a new knowledge store from git URL or local path',
    argsSchema: z.object({
      name: z.string().min(1).describe('Store name'),
      type: z.enum(['file', 'repo']).describe('Store type'),
      source: z.string().min(1).describe('Git URL or local path'),
      branch: z.string().optional().describe('Git branch (for repo type)'),
      description: z.string().optional().describe('Store description'),
    }),
    handler: (args, context) => handleCreateStore(args as unknown as CreateStoreArgs, context),
  },
  {
    name: 'store:index',
    description: 'Re-index a knowledge store to update search data',
    argsSchema: z.object({
      store: z.string().min(1).describe('Store name or ID'),
    }),
    handler: (args, context) => handleIndexStore(args as unknown as IndexStoreArgs, context),
  },
  {
    name: 'store:delete',
    description: 'Delete a knowledge store and all associated data',
    argsSchema: z.object({
      store: z.string().min(1).describe('Store name or ID'),
    }),
    handler: (args, context) => handleDeleteStore(args as unknown as DeleteStoreArgs, context),
  },
];
/* eslint-enable @typescript-eslint/consistent-type-assertions */
