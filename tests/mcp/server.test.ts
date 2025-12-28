import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPServer } from '../../src/mcp/server.js';

describe('MCP Server', () => {
  it('should create server with search tool', () => {
    const server = createMCPServer({
      dataDir: '/tmp/test',
      config: undefined
    });

    expect(server).toBeDefined();
    // MCP SDK doesn't expose tools list directly, so we test via integration
  });

  it('should handle search_codebase tool call', async () => {
    // Integration test - will implement after server is created
    expect(true).toBe(true);
  });
});
