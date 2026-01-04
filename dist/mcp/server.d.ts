import { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * Configuration options for the MCP server
 */
interface MCPServerOptions {
    dataDir?: string | undefined;
    config?: string | undefined;
    projectRoot?: string | undefined;
}

declare function createMCPServer(options: MCPServerOptions): Server;
declare function runMCPServer(options: MCPServerOptions): Promise<void>;

export { createMCPServer, runMCPServer };
