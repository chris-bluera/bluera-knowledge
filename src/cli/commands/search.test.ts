import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSearchCommand } from './search.js';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';
import type { SearchResponse } from '../../types/search.js';
import { createStoreId, createDocumentId } from '../../types/brands.js';

vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));

describe('search command execution', () => {
  let mockServices: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let getOptions: () => GlobalOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
        list: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
      search: {
        search: vi.fn(),
      },
    };

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    getOptions = () => ({
      config: undefined,
      dataDir: '/tmp/test',
      quiet: false,
      format: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('successful search', () => {
    it('performs basic search across all stores', async () => {
      const mockStores = [
        { id: createStoreId('store-1'), name: 'store1', type: 'file' as const },
        { id: createStoreId('store-2'), name: 'store2', type: 'repo' as const },
      ];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1'), createStoreId('store-2')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content here',
            highlight: 'Test content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file.ts',
            },
            summary: {
              type: 'function',
              name: 'testFunction',
              signature: 'function testFunction(): void',
              purpose: 'Tests something',
              location: '/test/file.ts:10',
              relevanceReason: 'Matches test query',
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(mockServices.store.list).toHaveBeenCalled();
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-2'));
      expect(mockServices.search.search).toHaveBeenCalledWith({
        query: 'test query',
        stores: [createStoreId('store-1'), createStoreId('store-2')],
        mode: 'hybrid',
        limit: 10,
        threshold: undefined,
        includeContent: undefined,
        detail: 'minimal',
      });
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('searches specific stores when --stores option is provided', async () => {
      const mockStores = [
        { id: createStoreId('store-1'), name: 'store1', type: 'file' as const },
        { id: createStoreId('store-2'), name: 'store2', type: 'repo' as const },
      ];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.store.getByIdOrName.mockImplementation((name: string) => {
        if (name === 'store1') return Promise.resolve(mockStores[0]);
        return Promise.resolve(undefined);
      });
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--stores', 'store1']);

      await actionHandler(['test query']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store1');
      expect(mockServices.search.search).toHaveBeenCalledWith({
        query: 'test query',
        stores: [createStoreId('store-1')],
        mode: 'hybrid',
        limit: 10,
        threshold: undefined,
        includeContent: undefined,
        detail: 'minimal',
      });
    });

    it('searches multiple specific stores', async () => {
      const mockStores = [
        { id: createStoreId('store-1'), name: 'store1', type: 'file' as const },
        { id: createStoreId('store-2'), name: 'store2', type: 'repo' as const },
      ];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1'), createStoreId('store-2')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.store.getByIdOrName.mockImplementation((name: string) => {
        if (name === 'store1') return Promise.resolve(mockStores[0]);
        if (name === 'store2') return Promise.resolve(mockStores[1]);
        return Promise.resolve(undefined);
      });
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--stores', 'store1, store2']);

      await actionHandler(['test query']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store1');
      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store2');
      expect(mockServices.search.search).toHaveBeenCalledWith({
        query: 'test query',
        stores: [createStoreId('store-1'), createStoreId('store-2')],
        mode: 'hybrid',
        limit: 10,
        threshold: undefined,
        includeContent: undefined,
        detail: 'minimal',
      });
    });

    it('uses vector mode when specified', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'vector',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--mode', 'vector']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'vector',
        })
      );
    });

    it('uses fts mode when specified', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'fts',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--mode', 'fts']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'fts',
        })
      );
    });

    it('respects limit option', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--limit', '25']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        })
      );
    });

    it('respects threshold option', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--threshold', '0.8']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 0.8,
        })
      );
    });

    it('respects includeContent option', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--include-content']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          includeContent: true,
        })
      );
    });

    it('respects detail option', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--detail', 'full']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'full',
        })
      );
    });
  });

  describe('error handling', () => {
    it('exits with code 3 when specified store not found', async () => {
      const { destroyServices } = await import('../../services/index.js');

      mockServices.store.list.mockResolvedValue([]);
      mockServices.store.getByIdOrName.mockResolvedValue(undefined);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--stores', 'nonexistent']);

      await expect(actionHandler(['test query'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store not found: nonexistent');
      expect(processExitSpy).toHaveBeenCalledWith(3);
      expect(mockServices.search.search).not.toHaveBeenCalled();
      // Must call destroyServices before process.exit per CLAUDE.md
      expect(destroyServices).toHaveBeenCalled();
    });

    it('exits with code 1 when no stores exist', async () => {
      const { destroyServices } = await import('../../services/index.js');

      mockServices.store.list.mockResolvedValue([]);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['test query'])).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('No stores to search. Create a store first.');
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockServices.search.search).not.toHaveBeenCalled();
      // Must call destroyServices before process.exit per CLAUDE.md
      expect(destroyServices).toHaveBeenCalled();
    });

    it('exits with code 3 when one of multiple stores not found', async () => {
      const { destroyServices } = await import('../../services/index.js');

      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.store.getByIdOrName.mockImplementation((name: string) => {
        if (name === 'store1') return Promise.resolve(mockStores[0]);
        return Promise.resolve(undefined);
      });

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--stores', 'store1,nonexistent']);

      await expect(actionHandler(['test query'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store not found: nonexistent');
      expect(processExitSpy).toHaveBeenCalledWith(3);
      // Must call destroyServices before process.exit per CLAUDE.md
      expect(destroyServices).toHaveBeenCalled();
    });
  });

  describe('output formats', () => {
    it('outputs JSON when format is json', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file.ts',
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"query": "test query"'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"mode": "hybrid"'));
    });

    it('outputs paths only in quiet mode', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file1.ts',
            },
          },
          {
            id: createDocumentId('doc-2'),
            score: 0.85,
            content: 'Another content',
            metadata: {
              type: 'web',
              storeId: createStoreId('store-1'),
              url: 'https://example.com/page',
            },
          },
        ],
        totalResults: 2,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: true,
        format: undefined,
      });

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith('/test/file1.ts');
      expect(consoleLogSpy).toHaveBeenCalledWith('https://example.com/page');
    });

    it('displays formatted results with summary in normal mode', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content here',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file.ts',
            },
            summary: {
              type: 'function',
              name: 'testFunction',
              signature: 'function testFunction(): void',
              purpose: 'Tests something',
              location: '/test/file.ts:10',
              relevanceReason: 'Matches test query',
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nSearch: "test query"');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Mode: hybrid'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1. [0.95] function: testFunction')
      );
    });

    it('displays formatted results without summary in normal mode', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content:
              'This is a long piece of content that should be truncated in the preview because it exceeds the maximum length allowed for display in the search results view.',
            highlight: 'This is a long piece of content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file.ts',
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('1. [0.95] /test/file.ts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('This is a long piece of content')
      );
    });

    it('shows "No results found" when no results', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'nonexistent query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['nonexistent query']);

      expect(consoleLogSpy).toHaveBeenCalledWith('No results found.\n');
    });

    it('displays context in contextual detail mode', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
              path: '/test/file.ts',
            },
            summary: {
              type: 'function',
              name: 'testFunction',
              signature: 'function testFunction(): void',
              purpose: 'Tests something',
              location: '/test/file.ts:10',
              relevanceReason: 'Matches test query',
            },
            context: {
              interfaces: ['ITest', 'ITestable'],
              keyImports: ['import { test } from "test"', 'import { mock } from "mock"'],
              relatedConcepts: ['testing', 'mocking', 'assertions'],
              usage: {
                calledBy: 5,
                calls: 3,
              },
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--detail', 'contextual']);

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Imports: import { test } from "test"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Related: testing, mocking, assertions')
      );
    });

    it('handles results with fallback path display when path is missing', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [
          {
            id: createDocumentId('doc-1'),
            score: 0.95,
            content: 'Test content',
            metadata: {
              type: 'file',
              storeId: createStoreId('store-1'),
            },
          },
        ],
        totalResults: 1,
        timeMs: 50,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('1. [0.95] unknown'));
    });
  });

  describe('store initialization', () => {
    it('initializes all stores before searching', async () => {
      const mockStores = [
        { id: createStoreId('store-1'), name: 'store1', type: 'file' as const },
        { id: createStoreId('store-2'), name: 'store2', type: 'repo' as const },
        { id: createStoreId('store-3'), name: 'store3', type: 'web' as const },
      ];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1'), createStoreId('store-2'), createStoreId('store-3')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(mockServices.lance.initialize).toHaveBeenCalledTimes(3);
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-2'));
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-3'));
    });

    it('initializes only specified stores', async () => {
      const mockStores = [
        { id: createStoreId('store-1'), name: 'store1', type: 'file' as const },
        { id: createStoreId('store-2'), name: 'store2', type: 'repo' as const },
      ];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.store.getByIdOrName.mockImplementation((name: string) => {
        if (name === 'store1') return Promise.resolve(mockStores[0]);
        return Promise.resolve(undefined);
      });
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--stores', 'store1']);

      await actionHandler(['test query']);

      expect(mockServices.lance.initialize).toHaveBeenCalledTimes(1);
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
    });
  });

  describe('option parsing', () => {
    it('parses limit as integer', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--limit', '100']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        })
      );
    });

    it('parses threshold as float', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;
      command.parseOptions(['--threshold', '0.75']);

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          threshold: 0.75,
        })
      );
    });

    it('uses default limit of 10 when not specified', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    it('uses default detail of minimal when not specified', async () => {
      const mockStores = [{ id: createStoreId('store-1'), name: 'store1', type: 'file' as const }];

      const mockSearchResponse: SearchResponse = {
        query: 'test query',
        mode: 'hybrid',
        stores: [createStoreId('store-1')],
        results: [],
        totalResults: 0,
        timeMs: 10,
      };

      mockServices.store.list.mockResolvedValue(mockStores);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.search.search.mockResolvedValue(mockSearchResponse);

      const command = createSearchCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['test query']);

      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'minimal',
        })
      );
    });
  });
});
