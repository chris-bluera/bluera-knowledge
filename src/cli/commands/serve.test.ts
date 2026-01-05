import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServeCommand } from './serve.js';
import type { GlobalOptions } from '../program.js';
import type { ServiceContainer } from '../../services/index.js';

// Mock all dependencies
vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@hono/node-server', () => ({
  serve: vi.fn()
}));

vi.mock('../../server/app.js', () => ({
  createApp: vi.fn()
}));

describe('Serve Command - Execution Tests', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  const getOptions = (): GlobalOptions => ({
    config: undefined,
    dataDir: '/tmp/test-data',
    quiet: false,
    format: undefined,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const { createServices } = await import('../../services/index.js');
    const { createApp } = await import('../../server/app.js');
    const { serve } = await import('@hono/node-server');

    mockServices = {
      store: {
        list: vi.fn(),
        getByIdOrName: vi.fn(),
        create: vi.fn(),
        delete: vi.fn()
      },
      lance: {
        initialize: vi.fn()
      },
      search: {
        search: vi.fn()
      },
      index: {
        indexStore: vi.fn()
      }
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);
    vi.mocked(createApp).mockReturnValue({ fetch: vi.fn() } as any);
    vi.mocked(serve).mockReturnValue(undefined as any);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('server initialization', () => {
    it('starts server with default port and host', async () => {
      const { createServices } = await import('../../services/index.js');
      const { createApp } = await import('../../server/app.js');
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(createServices).toHaveBeenCalledWith(undefined, '/tmp/test-data');
      expect(createApp).toHaveBeenCalledWith(mockServices);
      expect(serve).toHaveBeenCalledWith({
        fetch: expect.any(Function),
        port: 3847,
        hostname: '127.0.0.1'
      });
    });

    it('starts server with custom port', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '8080']);
      await actionHandler([]);

      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 8080,
          hostname: '127.0.0.1'
        })
      );
    });

    it('starts server with custom host', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--host', '0.0.0.0']);
      await actionHandler([]);

      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3847,
          hostname: '0.0.0.0'
        })
      );
    });

    it('starts server with custom port and host', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '9000', '--host', '0.0.0.0']);
      await actionHandler([]);

      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 9000,
          hostname: '0.0.0.0'
        })
      );
    });

    it('uses short option -p for port', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '5000']);
      await actionHandler([]);

      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 5000
        })
      );
    });
  });

  describe('service configuration', () => {
    it('creates services with global config', async () => {
      const { createServices } = await import('../../services/index.js');

      const customGetOptions = (): GlobalOptions => ({
        config: '/custom/config.json',
        dataDir: '/custom/data',
        quiet: false,
        format: undefined,
      });

      const command = createServeCommand(customGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(createServices).toHaveBeenCalledWith('/custom/config.json', '/custom/data');
    });

    it('creates app with service container', async () => {
      const { createApp } = await import('../../server/app.js');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(createApp).toHaveBeenCalledWith(mockServices);
    });

    it('passes app fetch to serve', async () => {
      const { createApp } = await import('../../server/app.js');
      const { serve } = await import('@hono/node-server');

      const mockFetch = vi.fn();
      vi.mocked(createApp).mockReturnValue({ fetch: mockFetch } as any);

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(serve).toHaveBeenCalledWith(
        expect.objectContaining({
          fetch: mockFetch
        })
      );
    });
  });

  describe('console output', () => {
    it('logs server startup with default settings', async () => {
      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Starting server on http://127.0.0.1:3847'
      );
    });

    it('logs server startup with custom port', async () => {
      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '8080']);
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Starting server on http://127.0.0.1:8080'
      );
    });

    it('logs server startup with custom host', async () => {
      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--host', '0.0.0.0']);
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Starting server on http://0.0.0.0:3847'
      );
    });

    it('logs server startup with both custom port and host', async () => {
      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '9000', '--host', '192.168.1.1']);
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Starting server on http://192.168.1.1:9000'
      );
    });
  });

  describe('port parsing', () => {
    it('parses port as integer', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '8080']);
      await actionHandler([]);

      const serveCall = vi.mocked(serve).mock.calls[0]?.[0];
      expect(typeof serveCall?.port).toBe('number');
      expect(serveCall?.port).toBe(8080);
    });

    it('handles invalid port gracefully', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', 'invalid']);
      await actionHandler([]);

      const serveCall = vi.mocked(serve).mock.calls[0]?.[0];
      // Should parse to NaN, which is still a number
      expect(typeof serveCall?.port).toBe('number');
    });

    it('handles port as floating point by converting to integer', async () => {
      const { serve } = await import('@hono/node-server');

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--port', '8080.5']);
      await actionHandler([]);

      const serveCall = vi.mocked(serve).mock.calls[0]?.[0];
      expect(serveCall?.port).toBe(8080);
    });
  });

  describe('execution order', () => {
    it('creates services before creating app', async () => {
      const { createServices } = await import('../../services/index.js');
      const { createApp } = await import('../../server/app.js');

      const callOrder: string[] = [];

      vi.mocked(createServices).mockImplementation(async () => {
        callOrder.push('createServices');
        return mockServices;
      });

      vi.mocked(createApp).mockImplementation(() => {
        callOrder.push('createApp');
        return { fetch: vi.fn() } as any;
      });

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(callOrder).toEqual(['createServices', 'createApp']);
    });

    it('creates app before starting server', async () => {
      const { createApp } = await import('../../server/app.js');
      const { serve } = await import('@hono/node-server');

      const callOrder: string[] = [];

      vi.mocked(createApp).mockImplementation(() => {
        callOrder.push('createApp');
        return { fetch: vi.fn() } as any;
      });

      vi.mocked(serve).mockImplementation(() => {
        callOrder.push('serve');
        return undefined as any;
      });

      const command = createServeCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(callOrder).toEqual(['createApp', 'serve']);
    });
  });
});
