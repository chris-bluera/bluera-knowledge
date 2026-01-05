import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServices } from '../services/index.js';
import { tools } from './handlers/index.js';
import type { MCPServerOptions } from './types.js';

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
          name: 'delete_store',
          description: 'Delete a knowledge store and all associated data (database, cloned files)',
          inputSchema: {
            type: 'object',
            properties: {
              store: {
                type: 'string',
                description: 'Store name or ID to delete'
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
        },
        {
          name: 'check_job_status',
          description: 'Check the status of a background job (clone, index, crawl operations)',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'Job ID to check status for'
              }
            },
            required: ['jobId']
          }
        },
        {
          name: 'list_jobs',
          description: 'List all background jobs, optionally filtered by status',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
                description: 'Filter jobs by status (optional)'
              },
              activeOnly: {
                type: 'boolean',
                default: false,
                description: 'Only show active (pending/running) jobs'
              }
            }
          }
        },
        {
          name: 'cancel_job',
          description: 'Cancel a running or pending background job',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: {
                type: 'string',
                description: 'Job ID to cancel'
              }
            },
            required: ['jobId']
          }
        }
      ]
    });
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Find handler in registry
    const tool = tools.find(t => t.name === name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Validate arguments with Zod
    const validated = tool.schema.parse(args ?? {});

    // Create services once
    const services = await createServices(
      options.config,
      options.dataDir,
      options.projectRoot
    );

    // Execute handler with context
    return tool.handler(validated, { services, options });
  });

  return server;
}

export async function runMCPServer(options: MCPServerOptions): Promise<void> {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Bluera Knowledge MCP server running on stdio');
}

// Run the server only when this file is executed directly (not imported by CLI)
// Check if we're running as the mcp/server entry point vs being imported by index.js
const scriptPath = process.argv[1] ?? '';
const isMCPServerEntry = scriptPath.endsWith('mcp/server.js') || scriptPath.endsWith('mcp/server');

if (isMCPServerEntry) {
  runMCPServer({
    dataDir: process.env['DATA_DIR'],
    config: process.env['CONFIG_PATH'],
    projectRoot: process.env['PROJECT_ROOT'] ?? process.env['PWD']
  }).catch((error: unknown) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}
