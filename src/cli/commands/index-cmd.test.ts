import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIndexCommand } from './index-cmd.js';
import type { GlobalOptions } from '../program.js';
import type { ServiceContainer } from '../../services/index.js';
import type { Store } from '../../types/store.js';
import type { IndexEvent } from '../../services/index.service.js';

// Mock dependencies
vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
    text: '',
  })),
}));

vi.mock('../../services/watch.service.js', () => ({
  WatchService: vi.fn(),
}));

describe('createIndexCommand - Execution Tests', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let processOnSpy: ReturnType<typeof vi.spyOn>;
  let getOptions: () => GlobalOptions;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { createServices } = await import('../../services/index.js');

    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
        list: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
        search: vi.fn(),
        addDocuments: vi.fn(),
        createFtsIndex: vi.fn(),
      },
      search: {
        search: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
      embeddings: {
        embed: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);

    // Mock process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });

    getOptions = (): GlobalOptions => ({
      config: undefined,
      dataDir: '/tmp/test-data',
      quiet: false,
      format: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('index command - successful indexing', () => {
    it('indexes a store successfully', async () => {
      const mockStore: Store = {
        id: 'store-123',
        name: 'test-store',
        type: 'file',
        path: '/test/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 10,
          chunksCreated: 25,
          timeMs: 1500,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test-store']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('test-store');
      expect(mockServices.lance.initialize).toHaveBeenCalledWith('store-123');
      expect(mockServices.index.indexStore).toHaveBeenCalled();
    });

    it('outputs success message in normal mode', async () => {
      const mockStore: Store = {
        id: 'store-123',
        name: 'my-store',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 5,
          chunksCreated: 12,
          timeMs: 800,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['my-store']);

      expect(consoleLogSpy).toHaveBeenCalledWith('Indexed 5 documents, 12 chunks in 800ms');
    });

    it('outputs JSON format when format=json', async () => {
      getOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/tmp/test-data',
        quiet: false,
        format: 'json',
      });

      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 3,
          chunksCreated: 7,
          timeMs: 500,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"documentsIndexed": 3'));

      const jsonOutput = JSON.parse(consoleLogSpy.mock.calls[0]?.[0] as string);
      expect(jsonOutput.documentsIndexed).toBe(3);
      expect(jsonOutput.chunksCreated).toBe(7);
      expect(jsonOutput.timeMs).toBe(500);
    });

    it('suppresses initial message in quiet mode', async () => {
      getOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/tmp/test-data',
        quiet: true,
        format: undefined,
      });

      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 1,
          chunksCreated: 2,
          timeMs: 100,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('uses spinner in interactive mode (TTY)', async () => {
      const ora = (await import('ora')).default;
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 1,
          chunksCreated: 2,
          timeMs: 100,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(ora).toHaveBeenCalled();
    });

    it('handles progress events during indexing', async () => {
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      let progressCallback: ((event: IndexEvent) => void) | undefined;
      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockImplementation(async (store, callback) => {
        progressCallback = callback;
        callback?.({ type: 'progress', current: 1, total: 5, message: 'Processing file1.txt' });
        callback?.({ type: 'progress', current: 2, total: 5, message: 'Processing file2.txt' });
        return {
          success: true,
          data: {
            documentsIndexed: 5,
            chunksCreated: 10,
            timeMs: 1000,
          },
        };
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(progressCallback).toBeDefined();
    });

    it('uses store ID instead of name', async () => {
      const mockStore: Store = {
        id: 'abc-def-123',
        name: 'test',
        type: 'repo',
        url: 'https://github.com/test/repo',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 1,
          chunksCreated: 1,
          timeMs: 100,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['abc-def-123']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('abc-def-123');
      expect(mockServices.lance.initialize).toHaveBeenCalledWith('abc-def-123');
    });
  });

  describe('index command - error handling', () => {
    it('exits with code 3 when store not found', async () => {
      const { destroyServices } = await import('../../services/index.js');

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await expect(action(['nonexistent-store'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store not found: nonexistent-store');
      expect(processExitSpy).toHaveBeenCalledWith(3);
      // Must call destroyServices before process.exit per CLAUDE.md
      expect(destroyServices).toHaveBeenCalled();
    });

    it('exits with code 4 when indexing fails', async () => {
      const { destroyServices } = await import('../../services/index.js');

      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: false,
        error: new Error('Failed to read files'),
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await expect(action(['test'])).rejects.toThrow('process.exit: 4');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Failed to read files');
      expect(processExitSpy).toHaveBeenCalledWith(4);
      // Must call destroyServices before process.exit per CLAUDE.md
      expect(destroyServices).toHaveBeenCalled();
    });

    it('handles lance initialization errors', async () => {
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.lance.initialize).mockRejectedValue(new Error('Lance init failed'));

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;

      await expect(action(['test'])).rejects.toThrow('Lance init failed');
    });
  });

  describe('watch subcommand - successful watching', () => {
    it('watches a file store successfully', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'test-store',
        type: 'file',
        path: '/test/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      expect(watchCmd).toBeDefined();

      const action = watchCmd!._actionHandler;
      await action(['test-store']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('test-store');
      expect(WatchService).toHaveBeenCalledWith(mockServices.index, mockServices.lance);
      expect(mockWatchService.watch).toHaveBeenCalledWith(
        mockStore,
        1000,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('watches a repo store successfully', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'repo-store',
        type: 'repo',
        url: 'https://github.com/test/repo',
        path: '/local/clone/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await action(['repo-store']);

      expect(mockWatchService.watch).toHaveBeenCalled();
    });

    it('uses custom debounce value', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      watchCmd.parseOptions(['--debounce', '2500']);
      const action = watchCmd!._actionHandler;
      await action(['test']);

      expect(mockWatchService.watch).toHaveBeenCalledWith(
        mockStore,
        2500,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('outputs watching message in normal mode', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'my-store',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await action(['my-store']);

      expect(consoleLogSpy).toHaveBeenCalledWith('Watching my-store for changes...');
    });

    it('suppresses message in quiet mode', async () => {
      getOptions = (): GlobalOptions => ({
        config: undefined,
        dataDir: '/tmp/test-data',
        quiet: true,
        format: undefined,
      });

      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await action(['test']);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('calls re-index callback on file changes', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      let capturedCallback: (() => void) | undefined;
      const mockWatchService = {
        watch: vi.fn((store, debounce, onReindex, onError) => {
          capturedCallback = onReindex;
        }),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await action(['test']);

      expect(capturedCallback).toBeDefined();
      capturedCallback!();

      expect(consoleLogSpy).toHaveBeenCalledWith('Re-indexed test');
    });

    it('handles SIGINT to cleanup and exit', async () => {
      const { WatchService } = await import('../../services/watch.service.js');
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const mockWatchService = {
        watch: vi.fn(),
        unwatchAll: vi.fn(),
      };
      vi.mocked(WatchService).mockImplementation(function (this: any) {
        return mockWatchService as any;
      } as any);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await action(['test']);

      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Get the SIGINT handler and call it
      const sigintHandler = processOnSpy.mock.calls.find(
        (call) => call[0] === 'SIGINT'
      )?.[1] as () => void;
      expect(sigintHandler).toBeDefined();

      // Call the handler
      await sigintHandler();

      expect(mockWatchService.unwatchAll).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('watch subcommand - error handling', () => {
    it('exits with code 3 when store not found', async () => {
      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await expect(action(['nonexistent'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: File/repo store not found: nonexistent');
      expect(processExitSpy).toHaveBeenCalledWith(3);
    });

    it('exits with code 3 when store type is not file or repo', async () => {
      const mockStore: Store = {
        id: 'store-123',
        name: 'web-store',
        type: 'web',
        url: 'https://example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

      const command = createIndexCommand(getOptions);
      const watchCmd = command.commands.find((c) => c.name() === 'watch');
      const action = watchCmd!._actionHandler;
      await expect(action(['web-store'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: File/repo store not found: web-store');
      expect(processExitSpy).toHaveBeenCalledWith(3);
    });
  });

  describe('service interactions', () => {
    it('creates services with correct config and dataDir', async () => {
      const { createServices } = await import('../../services/index.js');
      getOptions = (): GlobalOptions => ({
        config: '/custom/config.json',
        dataDir: '/custom/data',
        quiet: false,
        format: undefined,
      });

      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: {
          documentsIndexed: 1,
          chunksCreated: 1,
          timeMs: 100,
        },
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(createServices).toHaveBeenCalledWith('/custom/config.json', '/custom/data');
    });

    it('calls services in correct order for indexing', async () => {
      const callOrder: string[] = [];
      const mockStore: Store = {
        id: 'store-123',
        name: 'test',
        type: 'file',
        path: '/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockServices.store.getByIdOrName).mockImplementation(async () => {
        callOrder.push('getByIdOrName');
        return mockStore;
      });
      vi.mocked(mockServices.lance.initialize).mockImplementation(async () => {
        callOrder.push('initialize');
      });
      vi.mocked(mockServices.index.indexStore).mockImplementation(async () => {
        callOrder.push('indexStore');
        return {
          success: true,
          data: {
            documentsIndexed: 1,
            chunksCreated: 1,
            timeMs: 100,
          },
        };
      });

      const command = createIndexCommand(getOptions);
      const action = command._actionHandler;
      await action(['test']);

      expect(callOrder).toEqual(['getByIdOrName', 'initialize', 'indexStore']);
    });
  });
});
