import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServices } from '../services/index.js';
import type { SearchQuery, DetailLevel } from '../types/search.js';
import type { StoreId } from '../types/brands.js';

interface MCPServerOptions {
  dataDir?: string | undefined;
  config?: string | undefined;
}

export function createMCPServer(options: MCPServerOptions) {
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_codebase',
          description: 'Search codebase with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.',
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
          name: 'get_full_context',
          description: 'Get complete code and context for a specific search result by ID. Use this after search_codebase to get full implementation details.',
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
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'search_codebase') {
      const services = await createServices(options.config, options.dataDir);

      if (!args) {
        throw new Error('No arguments provided');
      }

      const query = args['query'] as string;
      const detail = (args['detail'] as DetailLevel | undefined) ?? 'minimal';
      const limit = (args['limit'] as number | undefined) ?? 10;
      const stores = args['stores'] as string[] | undefined;

      // Get all stores if none specified
      let storeIds: StoreId[] = stores as StoreId[] ?? (await services.store.list()).map(s => s.id);

      // Initialize stores
      for (const storeId of storeIds) {
        await services.lance.initialize(storeId);
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

      // Calculate estimated tokens
      const estimatedTokens = results.results.reduce((sum, r) => {
        let tokens = 100; // Base for summary
        if (r.context) tokens += 200;
        if (r.full) tokens += 800;
        return sum + tokens;
      }, 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: results.results.map(r => ({
                id: r.id,
                score: r.score,
                summary: r.summary,
                context: r.context,
                full: r.full
              })),
              totalResults: results.totalResults,
              estimatedTokens,
              mode: results.mode,
              timeMs: results.timeMs
            }, null, 2)
          }
        ]
      };
    }

    if (name === 'get_full_context') {
      // TODO: Implement result caching and retrieval by ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Not yet implemented'
            })
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function runMCPServer(options: MCPServerOptions) {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Bluera Knowledge MCP server running on stdio');
}
