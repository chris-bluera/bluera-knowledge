import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCrawlCommand } from './crawl.js';
import { createServices } from '../../services/index.js';
import { IntelligentCrawler } from '../../crawl/intelligent-crawler.js';
import type { GlobalOptions } from '../program.js';
import type { WebStore } from '../../types/store.js';
import { createStoreId, createDocumentId } from '../../types/brands.js';

vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../crawl/intelligent-crawler.js', () => ({
  IntelligentCrawler: vi.fn(),
}));
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
    text: '',
  })),
}));

describe('crawl command execution', () => {
  let mockServices: any;
  let mockCrawler: any;
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
        create: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
        addDocuments: vi.fn(),
      },
      embeddings: {
        embed: vi.fn(),
      },
    };

    mockCrawler = {
      crawl: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    };

    vi.mocked(createServices).mockResolvedValue(mockServices);
    vi.mocked(IntelligentCrawler).mockImplementation(function(this: any) {
      return mockCrawler as any;
    } as any);

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

  describe('successful crawling', () => {
    it('successfully crawls and indexes pages in intelligent mode', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      const crawlResults = [
        {
          url: 'https://example.com/page1',
          title: 'Page 1',
          markdown: '# Page 1 content',
          depth: 0,
        },
        {
          url: 'https://example.com/page2',
          title: 'Page 2',
          markdown: '# Page 2 content',
          extracted: 'Extracted content',
          depth: 1,
        },
      ];

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          for (const result of crawlResults) {
            yield result;
          }
        })()
      );

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--crawl', 'all documentation pages', '--max-pages', '50']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('test-store');
      expect(mockServices.lance.initialize).toHaveBeenCalledWith(mockStore.id);
      expect(mockCrawler.crawl).toHaveBeenCalledWith('https://example.com', {
        crawlInstruction: 'all documentation pages',
        maxPages: 50,
        useHeadless: false,
      });
      expect(mockServices.embeddings.embed).toHaveBeenCalledTimes(2);
      expect(mockServices.lance.addDocuments).toHaveBeenCalledWith(
        mockStore.id,
        expect.arrayContaining([
          expect.objectContaining({
            content: '# Page 1 content',
            metadata: expect.objectContaining({
              type: 'web',
              url: 'https://example.com/page1',
              title: 'Page 1',
              extracted: false,
            }),
          }),
          expect.objectContaining({
            content: 'Extracted content',
            metadata: expect.objectContaining({
              type: 'web',
              url: 'https://example.com/page2',
              title: 'Page 2',
              extracted: true,
            }),
          }),
        ])
      );
      expect(mockCrawler.stop).toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('successfully crawls in simple mode', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Page 1',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--simple', '--max-pages', '25']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockCrawler.crawl).toHaveBeenCalledWith('https://example.com', {
        maxPages: 25,
        simple: true,
        useHeadless: false,
      });
      expect(mockCrawler.stop).toHaveBeenCalled();
    });

    it('uses extracted content when available for embedding', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Full markdown content',
            extracted: 'Extracted API docs',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--extract', 'API documentation']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockServices.embeddings.embed).toHaveBeenCalledWith('Extracted API docs');
      expect(mockServices.lance.addDocuments).toHaveBeenCalledWith(
        mockStore.id,
        expect.arrayContaining([
          expect.objectContaining({
            content: 'Extracted API docs',
            metadata: expect.objectContaining({
              extracted: true,
            }),
          }),
        ])
      );
    });

    it('handles crawl with both crawl and extract instructions', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--crawl', 'all Getting Started pages', '--extract', 'code examples', '--max-pages', '100']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockCrawler.crawl).toHaveBeenCalledWith('https://example.com', {
        crawlInstruction: 'all Getting Started pages',
        extractInstruction: 'code examples',
        maxPages: 100,
        useHeadless: false,
      });
    });
  });

  describe('store auto-creation', () => {
    it('auto-creates web store when store does not exist', async () => {
      const createdStore: WebStore = {
        id: createStoreId('new-store-id'),
        name: 'new-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(undefined);
      mockServices.store.create.mockResolvedValue({ success: true, data: createdStore });
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'new-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'new-store',
        type: 'web',
        url: 'https://example.com',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Created web store: new-store');
      expect(mockCrawler.crawl).toHaveBeenCalled();
    });

    it('throws error when store creation fails', async () => {
      mockServices.store.getByIdOrName.mockResolvedValue(undefined);
      mockServices.store.create.mockResolvedValue({ success: false, error: new Error('Name already exists') });

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'bad-store'])).rejects.toThrow(
        'Failed to create store: Name already exists'
      );
      expect(mockCrawler.crawl).not.toHaveBeenCalled();
    });

    it('includes storeCreated in JSON output when store was created', async () => {
      const createdStore: WebStore = {
        id: createStoreId('new-store-id'),
        name: 'new-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(undefined);
      mockServices.store.create.mockResolvedValue({ success: true, data: createdStore });
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'new-store']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"storeCreated": true')
      );
    });
  });

  describe('error handling', () => {
    it('throws error when store is not a web store', async () => {
      const mockFileStore = {
        id: createStoreId('store-1'),
        name: 'file-store',
        type: 'file',
        path: '/some/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockFileStore);

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'file-store'])).rejects.toThrow(
        'Store "file-store" exists but is not a web store (type: file)'
      );
    });

    it('exits with code 6 when crawling fails', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);

      const crawlError = new Error('Network timeout');
      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          throw crawlError;
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'test-store'])).rejects.toThrow('process.exit: 6');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Crawl failed: Network timeout');
      expect(processExitSpy).toHaveBeenCalledWith(6);
      expect(mockCrawler.stop).toHaveBeenCalled();
    });

    it('exits with code 6 when embedding fails', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockRejectedValue(new Error('Embedding service unavailable'));

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'test-store'])).rejects.toThrow('process.exit: 6');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Crawl failed: Embedding service unavailable'
      );
      expect(processExitSpy).toHaveBeenCalledWith(6);
      expect(mockCrawler.stop).toHaveBeenCalled();
    });

    it('exits with code 6 when indexing fails', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockRejectedValue(new Error('Database write error'));

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'test-store'])).rejects.toThrow('process.exit: 6');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Crawl failed: Database write error');
      expect(processExitSpy).toHaveBeenCalledWith(6);
      expect(mockCrawler.stop).toHaveBeenCalled();
    });

    it('always calls crawler.stop in finally block', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          throw new Error('Test error');
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await expect(actionHandler(['https://example.com', 'test-store'])).rejects.toThrow();

      expect(mockCrawler.stop).toHaveBeenCalled();
    });
  });

  describe('output formats', () => {
    it('outputs JSON when format is json', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--crawl', 'test', '--max-pages', '10']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"store": "test-store"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"pagesCrawled": 1')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"mode": "intelligent"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"hadCrawlInstruction": true')
      );
    });

    it('outputs text in quiet mode', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
          yield {
            url: 'https://example.com/page2',
            title: 'Page 2',
            markdown: '# Content 2',
            depth: 1,
          };
        })()
      );

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: true,
        format: undefined,
      });

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      // In quiet mode, no output
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('does not output in quiet mode with JSON format', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: true,
        format: 'json',
      });

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      // Should only output JSON, not the "Crawling..." message
      const jsonCalls = consoleLogSpy.mock.calls.filter((call: any[]) =>
        call[0].includes('"success"')
      );
      expect(jsonCalls.length).toBe(1);
    });
  });

  describe('progress tracking', () => {
    it('listens for progress events from crawler', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockCrawler.on).toHaveBeenCalledWith('progress', expect.any(Function));
    });
  });

  describe('maxPages option', () => {
    it('uses default maxPages of 50 when not specified', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockCrawler.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          maxPages: 50,
        })
      );
    });

    it('parses maxPages from string option', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      command.parseOptions(['--max-pages', '200']);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      expect(mockCrawler.crawl).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          maxPages: 200,
        })
      );
    });
  });

  describe('document creation', () => {
    it('creates documents with correct metadata', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      const beforeIndex = new Date();

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Test Page',
            markdown: '# Test Content',
            depth: 2,
          };
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      const afterIndex = new Date();

      expect(mockServices.lance.addDocuments).toHaveBeenCalledWith(
        mockStore.id,
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            content: '# Test Content',
            vector: [0.1, 0.2, 0.3],
            metadata: expect.objectContaining({
              type: 'web',
              storeId: mockStore.id,
              url: 'https://example.com/page1',
              title: 'Test Page',
              extracted: false,
              depth: 2,
            }),
          }),
        ])
      );

      // Verify indexedAt is reasonable
      const call = mockServices.lance.addDocuments.mock.calls[0];
      const docs = call[1];
      const indexedAt = docs[0].metadata.indexedAt;
      expect(indexedAt.getTime()).toBeGreaterThanOrEqual(beforeIndex.getTime());
      expect(indexedAt.getTime()).toBeLessThanOrEqual(afterIndex.getTime());
    });

    it('handles empty crawl results', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          // No results
        })()
      );

      const command = createCrawlCommand(getOptions);
      const actionHandler = command._actionHandler;

      await actionHandler(['https://example.com', 'test-store']);

      // Should not call addDocuments when no results
      expect(mockServices.lance.addDocuments).not.toHaveBeenCalled();
      expect(mockCrawler.stop).toHaveBeenCalled();
    });
  });

  describe('progress event handlers', () => {
    it('handles strategy progress events with spinner', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      let progressCallback: any;
      mockCrawler.on.mockImplementation((event: string, callback: any) => {
        if (event === 'progress') {
          progressCallback = callback;
        }
      });

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          // Trigger progress events
          if (progressCallback) {
            progressCallback({ type: 'strategy', message: 'Planning crawl...' });
            progressCallback({ type: 'strategy', message: undefined }); // Test fallback
            progressCallback({ type: 'page', pagesVisited: 0, currentUrl: 'https://example.com/page1' });
            progressCallback({ type: 'page', pagesVisited: 1, currentUrl: undefined }); // Test fallback
            progressCallback({ type: 'extraction', currentUrl: 'https://example.com/page1' });
            progressCallback({ type: 'extraction', currentUrl: undefined }); // Test fallback
            progressCallback({ type: 'error', message: 'Warning: skipped page' });
          }

          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      // Enable TTY mode to get spinner
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      try {
        const command = createCrawlCommand(getOptions);
        const actionHandler = command._actionHandler;

        await actionHandler(['https://example.com', 'test-store']);

        expect(mockCrawler.on).toHaveBeenCalledWith('progress', expect.any(Function));
      } finally {
        Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
      }
    });

    it('handles non-TTY output mode', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.lance.initialize.mockResolvedValue(undefined);
      mockServices.embeddings.embed.mockResolvedValue([0.1, 0.2, 0.3]);
      mockServices.lance.addDocuments.mockResolvedValue(undefined);

      mockCrawler.crawl.mockReturnValue(
        (async function* () {
          yield {
            url: 'https://example.com/page1',
            title: 'Page 1',
            markdown: '# Content',
            depth: 0,
          };
        })()
      );

      // Disable TTY mode
      const originalIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

      try {
        const command = createCrawlCommand(getOptions);
        const actionHandler = command._actionHandler;

        await actionHandler(['https://example.com', 'test-store']);

        expect(consoleLogSpy).toHaveBeenCalledWith('Crawling https://example.com');
        expect(consoleLogSpy).toHaveBeenCalledWith('Crawled 1 pages, indexed 1 chunks');
      } finally {
        Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, configurable: true });
      }
    });
  });
});
