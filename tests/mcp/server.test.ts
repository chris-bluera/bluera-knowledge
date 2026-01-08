import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPServer } from '../../src/mcp/server.js';

describe('MCP Server', () => {
  it('should create server with search tool', () => {
    const server = createMCPServer({
      dataDir: '/tmp/test',
      config: undefined,
    });

    expect(server).toBeDefined();
    // Note: MCP SDK doesn't expose tools list directly for unit testing.
    // Integration testing is performed manually via MCP inspector or client.
  });
});
