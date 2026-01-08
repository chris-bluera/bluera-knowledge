import { describe, it, expect } from 'vitest';
import { createMCPServer } from './server.js';

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
});
