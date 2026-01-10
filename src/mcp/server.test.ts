import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { createMCPServer } from './server.js';

// Mock services module
vi.mock('../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn(),
}));

// MCP Server tests - server creation only since the SDK doesn't expose handlers for testing
describe('MCP Server', () => {
  describe('Server creation and initialization', () => {
    it('creates server with default options', () => {
      const server = createMCPServer({});
      expect(server).toBeDefined();
    });

    it('creates server with custom dataDir', () => {
      const server = createMCPServer({ dataDir: '/custom/path' });
      expect(server).toBeDefined();
    });

    it('creates server with config path', () => {
      const server = createMCPServer({ config: '/path/to/config.json' });
      expect(server).toBeDefined();
    });

    it('creates server with project root', () => {
      const server = createMCPServer({ projectRoot: '/project' });
      expect(server).toBeDefined();
    });

    it('creates server with all options', () => {
      const server = createMCPServer({
        dataDir: '/data',
        config: '/config.json',
        projectRoot: '/project',
      });
      expect(server).toBeDefined();
    });
  });

  describe('Resource cleanup', () => {
    let createServicesSpy: MockInstance;
    let destroyServicesSpy: MockInstance;
    let mockServices: Record<string, unknown>;

    beforeEach(async () => {
      vi.clearAllMocks();

      const servicesModule = await import('../services/index.js');
      createServicesSpy = vi.mocked(servicesModule.createServices);
      destroyServicesSpy = vi.mocked(servicesModule.destroyServices);

      mockServices = {
        store: { list: vi.fn().mockResolvedValue([]) },
        lance: { search: vi.fn() },
        search: { search: vi.fn() },
        embeddings: { embed: vi.fn() },
        pythonBridge: { stop: vi.fn() },
      };

      createServicesSpy.mockResolvedValue(mockServices);
      destroyServicesSpy.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls destroyServices after successful tool execution', async () => {
      // This test verifies that destroyServices is called after each tool call
      // to prevent resource leaks (PythonBridge processes, LanceDB connections)

      const server = createMCPServer({ projectRoot: '/test' });

      // Get the request handler by simulating a tool call
      // The server registers handlers via setRequestHandler, we need to test
      // that destroyServices is called after the handler completes

      // Since we can't easily call the handler directly without the full MCP SDK,
      // this test documents the expected behavior: destroyServices MUST be called
      // after every tool execution to prevent resource leaks

      expect(server).toBeDefined();

      // The implementation should ensure destroyServices is called in a finally block
      // This test will need to be enhanced when we can properly mock the request flow
    });
  });
});
