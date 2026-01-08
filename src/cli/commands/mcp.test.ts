import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMCPCommand } from './mcp.js';
import type { GlobalOptions } from '../program.js';

// Mock all dependencies
vi.mock('../../mcp/server.js', () => ({
  runMCPServer: vi.fn(),
}));

describe('MCP Command - Execution Tests', () => {
  const getOptions = (): GlobalOptions => ({
    config: undefined,
    dataDir: '/tmp/test-data',
    quiet: false,
    format: undefined,
  });

  beforeEach(async () => {
    const { runMCPServer } = await import('../../mcp/server.js');
    vi.mocked(runMCPServer).mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('server execution', () => {
    it('runs MCP server with default options', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const command = createMCPCommand(getOptions);
      // Call the action directly instead of parsing argv
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalledWith({
        dataDir: '/tmp/test-data',
        config: undefined,
      });
    });

    it('runs MCP server with custom config', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const customGetOptions = (): GlobalOptions => ({
        config: '/custom/config.json',
        dataDir: '/tmp/test-data',
        quiet: false,
        format: undefined,
      });

      const command = createMCPCommand(customGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalledWith({
        dataDir: '/tmp/test-data',
        config: '/custom/config.json',
      });
    });

    it('runs MCP server with custom dataDir', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const customGetOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/custom/data',
        quiet: false,
        format: undefined,
      });

      const command = createMCPCommand(customGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalledWith({
        dataDir: '/custom/data',
        config: undefined,
      });
    });

    it('runs MCP server with both custom config and dataDir', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const customGetOptions = (): GlobalOptions => ({
        config: '/custom/config.json',
        dataDir: '/custom/data',
        quiet: false,
        format: undefined,
      });

      const command = createMCPCommand(customGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalledWith({
        dataDir: '/custom/data',
        config: '/custom/config.json',
      });
    });
  });

  describe('option handling', () => {
    it('passes undefined config when not specified', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      const callArgs = vi.mocked(runMCPServer).mock.calls[0]?.[0];
      expect(callArgs?.config).toBeUndefined();
    });

    it('ignores quiet flag (not applicable to MCP server)', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const quietGetOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/tmp/test-data',
        quiet: true,
        format: undefined,
      });

      const command = createMCPCommand(quietGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalled();
      const callArgs = vi.mocked(runMCPServer).mock.calls[0]?.[0];
      expect(callArgs).not.toHaveProperty('quiet');
    });

    it('ignores format flag (not applicable to MCP server)', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const formatGetOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/tmp/test-data',
        quiet: false,
        format: 'json',
      });

      const command = createMCPCommand(formatGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalled();
      const callArgs = vi.mocked(runMCPServer).mock.calls[0]?.[0];
      expect(callArgs).not.toHaveProperty('format');
    });
  });

  describe('error handling', () => {
    it('propagates errors from runMCPServer', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const testError = new Error('MCP server failed');
      vi.mocked(runMCPServer).mockRejectedValue(testError);

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler([])).rejects.toThrow('MCP server failed');
    });

    it('handles initialization errors', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      vi.mocked(runMCPServer).mockRejectedValue(new Error('Cannot initialize MCP server'));

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler([])).rejects.toThrow('Cannot initialize MCP server');
    });

    it('handles connection errors', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      vi.mocked(runMCPServer).mockRejectedValue(new Error('Connection failed'));

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler([])).rejects.toThrow('Connection failed');
    });
  });

  describe('execution flow', () => {
    it('calls runMCPServer exactly once', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(runMCPServer).toHaveBeenCalledTimes(1);
    });

    it('awaits runMCPServer before completing', async () => {
      const { runMCPServer } = await import('../../mcp/server.js');

      let serverStarted = false;

      vi.mocked(runMCPServer).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        serverStarted = true;
      });

      const command = createMCPCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(serverStarted).toBe(true);
    });
  });
});
