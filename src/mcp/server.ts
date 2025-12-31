import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServices } from '../services/index.js';
import type { SearchQuery, DetailLevel, SearchResult } from '../types/search.js';
import type { StoreId, DocumentId } from '../types/brands.js';

interface MCPServerOptions {
  dataDir?: string | undefined;
  config?: string | undefined;
}

// In-memory result cache for get_full_context
// Maps document ID to full search result
const resultCache = new Map<DocumentId, SearchResult>();

// eslint-disable-next-line @typescript-eslint/no-deprecated
export function createMCPServer(options: MCPServerOptions): Server {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const server = new Server(
    {
      name: 'bluera-knowledge',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, () => {
    return Promise.resolve({
      tools: [
        {
          name: 'search',
          description: 'Search all indexed knowledge stores with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (can include type signatures, constraints, or natural language)'
              },
              intent: {
                type: 'string',
                enum: ['find-pattern', 'find-implementation', 'find-usage', 'find-definition', 'find-documentation'],
                description: 'Search intent for better ranking'
              },
              detail: {
                type: 'string',
                enum: ['minimal', 'contextual', 'full'],
                default: 'minimal',
                description: 'Context detail level: minimal (summary only), contextual (+ imports/types), full (+ complete code)'
              },
              limit: {
                type: 'number',
                default: 10,
                description: 'Maximum number of results'
              },
              stores: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific store IDs to search (optional)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'list_stores',
          description: 'List all indexed knowledge stores (library sources, reference material, documentation)',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['file', 'repo', 'web'],
                description: 'Filter by store type (optional)'
              }
            }
          }
        },
        {
          name: 'get_store_info',
          description: 'Get detailed information about a specific store including its file path for direct access',
          inputSchema: {
            type: 'object',
            properties: {
              store: {
                type: 'string',
                description: 'Store name or ID'
              }
            },
            required: ['store']
          }
        },
        {
          name: 'create_store',
          description: 'Create a new knowledge store from git URL or local path',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Store name'
              },
              type: {
                type: 'string',
                enum: ['file', 'repo'],
                description: 'Store type'
              },
              source: {
                type: 'string',
                description: 'Git URL or local path'
              },
              branch: {
                type: 'string',
                description: 'Git branch (for repo type)'
              },
              description: {
                type: 'string',
                description: 'Store description'
              }
            },
            required: ['name', 'type', 'source']
          }
        },
        {
          name: 'index_store',
          description: 'Index or re-index a knowledge store to make it searchable',
          inputSchema: {
            type: 'object',
            properties: {
              store: {
                type: 'string',
                description: 'Store name or ID'
              }
            },
            required: ['store']
          }
        },
        {
          name: 'get_full_context',
          description: 'Get complete code and context for a specific search result by ID. Use this after search to get full implementation details.',
          inputSchema: {
            type: 'object',
            properties: {
              resultId: {
                type: 'string',
                description: 'Result ID from previous search'
              }
            },
            required: ['resultId']
          }
        }
      ]
    });
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'search') {
      const services = await createServices(options.config, options.dataDir);

      if (!args) {
        throw new Error('No arguments provided');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const query = args['query'] as string;

      // Validate query input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('Invalid query: must be a non-empty string');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const detail = (args['detail'] as DetailLevel | undefined) ?? 'minimal';
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const limit = (args['limit'] as number | undefined) ?? 10;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const stores = args['stores'] as string[] | undefined;

      // Get all stores if none specified
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const storeIds: StoreId[] = stores !== undefined ? stores as StoreId[] : (await services.store.list()).map(s => s.id);

      // Initialize stores with error handling
      try {
        for (const storeId of storeIds) {
          await services.lance.initialize(storeId);
        }
      } catch (error) {
        throw new Error(`Failed to initialize vector stores: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Perform search
      const searchQuery: SearchQuery = {
        query,
        stores: storeIds,
        mode: 'hybrid',
        limit,
        detail
      };

      const results = await services.search.search(searchQuery);

      // Cache results for get_full_context
      for (const result of results.results) {
        resultCache.set(result.id, result);
      }

      // Calculate estimated tokens
      const estimatedTokens = results.results.reduce((sum, r) => {
        let tokens = 100; // Base for summary
        if (r.context) tokens += 200;
        if (r.full) tokens += 800;
        return sum + tokens;
      }, 0);

      // Add repoRoot to results for cloned repos
      const enhancedResults = await Promise.all(results.results.map(async (r) => {
        const storeId = r.metadata.storeId;
        const store = await services.store.getByIdOrName(storeId);

        return {
          id: r.id,
          score: r.score,
          summary: {
            ...r.summary,
            repoRoot: store !== undefined && store.type === 'repo' ? store.path : undefined
          },
          context: r.context,
          full: r.full
        };
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: enhancedResults,
              totalResults: results.totalResults,
              estimatedTokens,
              mode: results.mode,
              timeMs: results.timeMs
            }, null, 2)
          }
        ]
      };
    }

    if (name === 'list_stores') {
      const services = await createServices(options.config, options.dataDir);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const typeFilter = args?.['type'] as 'file' | 'repo' | 'web' | undefined;

      const stores = await services.store.list();
      const filtered = typeFilter !== undefined
        ? stores.filter(s => s.type === typeFilter)
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
    }

    if (name === 'get_store_info') {
      const services = await createServices(options.config, options.dataDir);

      if (!args) {
        throw new Error('No arguments provided');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const storeName = args['store'] as string;
      const store = await services.store.getByIdOrName(storeName);

      if (store === undefined) {
        throw new Error(`Store not found: ${storeName}`);
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
    }

    if (name === 'create_store') {
      const services = await createServices(options.config, options.dataDir);

      if (!args) {
        throw new Error('No arguments provided');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const storeName = args['name'] as string;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const storeType = args['type'] as 'file' | 'repo';
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const source = args['source'] as string;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const branch = args['branch'] as string | undefined;
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const description = args['description'] as string | undefined;

      // Determine if source is a URL or path
      const isUrl = source.startsWith('http://') || source.startsWith('https://') || source.startsWith('git@');

      const result = await services.store.create({
        name: storeName,
        type: storeType,
        ...(isUrl ? { url: source } : { path: source }),
        ...(branch !== undefined ? { branch } : {}),
        ...(description !== undefined ? { description } : {})
      });

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: result.data.id,
              name: result.data.name,
              type: result.data.type,
              path: 'path' in result.data ? result.data.path : undefined,
              created: true
            }, null, 2)
          }
        ]
      };
    }

    if (name === 'index_store') {
      const services = await createServices(options.config, options.dataDir);

      if (!args) {
        throw new Error('No arguments provided');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const storeName = args['store'] as string;
      const store = await services.store.getByIdOrName(storeName);

      if (store === undefined) {
        throw new Error(`Store not found: ${storeName}`);
      }

      const result = await services.index.indexStore(store);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              storeId: store.id,
              storeName: store.name,
              documentsIndexed: result.data.documentsIndexed,
              timeMs: result.data.timeMs
            }, null, 2)
          }
        ]
      };
    }

    if (name === 'get_full_context') {
      if (!args) {
        throw new Error('No arguments provided');
      }

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resultId = args['resultId'] as DocumentId | undefined;

      if (!resultId || typeof resultId !== 'string') {
        throw new Error('Invalid resultId: must be a non-empty string');
      }

      // Check cache for result
      const cachedResult = resultCache.get(resultId);

      if (!cachedResult) {
        throw new Error(`Result not found in cache: ${resultId}. Run a search first to cache results.`);
      }

      // If result already has full context, return it
      if (cachedResult.full) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: cachedResult.id,
                score: cachedResult.score,
                summary: cachedResult.summary,
                context: cachedResult.context,
                full: cachedResult.full
              }, null, 2)
            }
          ]
        };
      }

      // Otherwise, re-query with full detail
      const services = await createServices(options.config, options.dataDir);
      const store = await services.store.getByIdOrName(cachedResult.metadata.storeId);

      if (!store) {
        throw new Error(`Store not found: ${cachedResult.metadata.storeId}`);
      }

      await services.lance.initialize(store.id);

      const searchQuery: SearchQuery = {
        query: cachedResult.content.substring(0, 100), // Use snippet of content as query
        stores: [store.id],
        mode: 'hybrid',
        limit: 1,
        detail: 'full'
      };

      const results = await services.search.search(searchQuery);

      // Find matching result by ID
      const fullResult = results.results.find(r => r.id === resultId);

      if (!fullResult) {
        // Return cached result even if we couldn't get full detail
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                id: cachedResult.id,
                score: cachedResult.score,
                summary: cachedResult.summary,
                context: cachedResult.context,
                warning: 'Could not retrieve full context, returning cached minimal result'
              }, null, 2)
            }
          ]
        };
      }

      // Update cache with full result
      resultCache.set(resultId, fullResult);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: fullResult.id,
              score: fullResult.score,
              summary: fullResult.summary,
              context: fullResult.context,
              full: fullResult.full
            }, null, 2)
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function runMCPServer(options: MCPServerOptions): Promise<void> {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Bluera Knowledge MCP server running on stdio');
}

// Run the server when this file is executed directly
runMCPServer({
  dataDir: process.env['DATA_DIR'],
  config: process.env['CONFIG_PATH']
}).catch(console.error);
