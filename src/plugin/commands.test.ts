import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleSearch,
  handleAddRepo,
  handleAddFolder,
  handleIndex,
  handleStores,
  handleSuggest,
} from './commands.js';
import type { ServiceContainer } from '../services/index.js';

// Mock the createServices function
vi.mock('../services/index.js', () => ({
  createServices: vi.fn(),
}));

// Mock extractRepoName
vi.mock('./git-clone.js', () => ({
  extractRepoName: vi.fn((url: string) => {
    const match = /\/([^/]+?)(\.git)?$/.exec(url);
    return match?.[1] ?? 'repository';
  }),
}));

// Mock DependencyUsageAnalyzer
vi.mock('../analysis/dependency-usage-analyzer.js', () => {
  const DependencyUsageAnalyzer = vi.fn();
  DependencyUsageAnalyzer.prototype.analyze = vi.fn();
  return { DependencyUsageAnalyzer };
});

// Mock RepoUrlResolver
vi.mock('../analysis/repo-url-resolver.js', () => {
  const RepoUrlResolver = vi.fn();
  RepoUrlResolver.prototype.findRepoUrl = vi.fn();
  return { RepoUrlResolver };
});

// Mock ora
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn(),
    text: '',
  })),
}));

describe('Commands - handleSearch', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        list: vi.fn(),
        getByIdOrName: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
      search: {
        search: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searches all stores when no stores specified', async () => {
    const mockStores = [
      { id: 'store-1', name: 'test1', type: 'file' as const },
      { id: 'store-2', name: 'test2', type: 'repo' as const },
    ];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    await handleSearch({ query: 'test query' });

    expect(mockServices.store.list).toHaveBeenCalled();
    expect(mockServices.lance.initialize).toHaveBeenCalledTimes(2);
    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test query',
        stores: ['store-1', 'store-2'],
      })
    );
  });

  it('filters stores by name when stores parameter provided', async () => {
    const mockStores = [
      { id: 'store-1', name: 'test1', type: 'file' as const },
      { id: 'store-2', name: 'test2', type: 'repo' as const },
      { id: 'store-3', name: 'other', type: 'file' as const },
    ];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    await handleSearch({ query: 'test', stores: 'test1,test2' });

    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: ['store-1', 'store-2'],
      })
    );
  });

  it('uses custom limit when provided', async () => {
    const mockStores = [{ id: 'store-1', name: 'test', type: 'file' as const }];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    await handleSearch({ query: 'test', limit: '25' });

    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 25,
      })
    );
  });

  it('uses default limit of 10 when not provided', async () => {
    const mockStores = [{ id: 'store-1', name: 'test', type: 'file' as const }];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    await handleSearch({ query: 'test' });

    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 10,
      })
    );
  });

  it('exits with error when no stores found', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    // Catch the error that will be thrown after process.exit is mocked
    try {
      await handleSearch({ query: 'test' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('No stores found to search');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('displays search results with summary', async () => {
    const mockStores = [{ id: 'store-1', name: 'test', type: 'file' as const }];
    const mockResults = {
      results: [
        {
          score: 0.95,
          summary: {
            location: 'test.ts:10-20',
            purpose: 'Test function',
          },
        },
      ],
      totalResults: 1,
    };

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue(mockResults);

    await handleSearch({ query: 'test' });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 results'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('0.95'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test.ts:10-20'));
  });

  it('handles results without summary gracefully', async () => {
    const mockStores = [{ id: 'store-1', name: 'test', type: 'file' as const }];
    const mockResults = {
      results: [{ score: 0.5 }],
      totalResults: 1,
    };

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);
    vi.mocked(mockServices.search.search).mockResolvedValue(mockResults);

    await handleSearch({ query: 'test' });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Found 1 results'));
  });
});

describe('Commands - handleAddRepo', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        list: vi.fn(),
        getByIdOrName: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates repo store with extracted name', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'test-repo',
        type: 'repo',
        path: '/tmp/test-repo',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleAddRepo({ url: 'https://github.com/user/test-repo.git' });

    expect(mockServices.store.create).toHaveBeenCalledWith({
      name: 'test-repo',
      type: 'repo',
      url: 'https://github.com/user/test-repo.git',
    });
  });

  it('uses custom name when provided', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'my-name',
        type: 'repo',
        path: '/tmp/my-name',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleAddRepo({ url: 'https://github.com/user/repo.git', name: 'my-name' });

    expect(mockServices.store.create).toHaveBeenCalledWith({
      name: 'my-name',
      type: 'repo',
      url: 'https://github.com/user/repo.git',
    });
  });

  it('includes branch when provided', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'test-repo',
        type: 'repo',
        path: '/tmp/test-repo',
        branch: 'develop',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleAddRepo({ url: 'https://github.com/user/repo.git', branch: 'develop' });

    expect(mockServices.store.create).toHaveBeenCalledWith({
      name: 'repo',
      type: 'repo',
      url: 'https://github.com/user/repo.git',
      branch: 'develop',
    });
  });

  it('auto-indexes after creation', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'test',
      type: 'repo' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: mockStore,
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleAddRepo({ url: 'https://github.com/user/test.git' });

    expect(mockServices.index.indexStore).toHaveBeenCalledWith(mockStore);
  });

  it('exits on store creation failure', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: false,
      error: new Error('Clone failed'),
    });

    try {
      await handleAddRepo({ url: 'https://github.com/user/repo.git' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Clone failed');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('reports indexing failure without exiting', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'test',
        type: 'repo',
        path: '/tmp/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: false,
      error: new Error('Indexing failed'),
    });

    await handleAddRepo({ url: 'https://github.com/user/repo.git' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Indexing failed: Indexing failed');
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});

describe('Commands - handleAddFolder', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        create: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates file store with basename when no name provided', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'my-folder',
        type: 'file',
        path: '/path/to/my-folder',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 5, chunksCreated: 20, timeMs: 500 },
    });

    await handleAddFolder({ path: '/path/to/my-folder' });

    expect(mockServices.store.create).toHaveBeenCalledWith({
      name: 'my-folder',
      type: 'file',
      path: '/path/to/my-folder',
    });
  });

  it('uses custom name when provided', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: {
        id: 'store-1',
        name: 'custom',
        type: 'file',
        path: '/path/folder',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 5, chunksCreated: 20, timeMs: 500 },
    });

    await handleAddFolder({ path: '/path/folder', name: 'custom' });

    expect(mockServices.store.create).toHaveBeenCalledWith({
      name: 'custom',
      type: 'file',
      path: '/path/folder',
    });
  });

  it('auto-indexes after folder store creation', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'test',
      type: 'file' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: mockStore,
    });
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 5, chunksCreated: 20, timeMs: 500 },
    });

    await handleAddFolder({ path: '/tmp/test' });

    expect(mockServices.index.indexStore).toHaveBeenCalledWith(mockStore);
  });

  it('exits on folder store creation failure', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: false,
      error: new Error('Path not found'),
    });

    try {
      await handleAddFolder({ path: '/nonexistent' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Path not found');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe('Commands - handleIndex', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('indexes store by id', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'test',
      type: 'file' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleIndex({ store: 'store-1' });

    expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store-1');
    expect(mockServices.index.indexStore).toHaveBeenCalledWith(mockStore);
  });

  it('indexes store by name', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'my-store',
      type: 'file' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
    });

    await handleIndex({ store: 'my-store' });

    expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('my-store');
  });

  it('displays indexing statistics on success', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'test',
      type: 'file' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: { documentsIndexed: 25, chunksCreated: 100, timeMs: 2000 },
    });

    await handleIndex({ store: 'test' });

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('25'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('2000'));
  });

  it('exits when store not found', async () => {
    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

    try {
      await handleIndex({ store: 'nonexistent' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Store not found: nonexistent');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on indexing failure', async () => {
    const mockStore = {
      id: 'store-1',
      name: 'test',
      type: 'file' as const,
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: false,
      error: new Error('Indexing error'),
    });

    try {
      await handleIndex({ store: 'test' });
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Indexing error');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe('Commands - handleStores', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        list: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('displays all stores with details', async () => {
    const mockStores = [
      {
        id: 'store-1',
        name: 'test-file',
        type: 'file' as const,
        path: '/tmp/test',
        description: 'Test store',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'store-2',
        name: 'test-repo',
        type: 'repo' as const,
        path: '/tmp/repo',
        url: 'https://github.com/user/repo.git',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);

    await handleStores();

    // Check table header
    expect(consoleLogSpy).toHaveBeenCalledWith('| Name | Type | ID | Source |');
    expect(consoleLogSpy).toHaveBeenCalledWith('|------|------|----|--------------------|');
    // Check row content
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test-file'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('test-repo'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('store-1'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/test'));
  });

  it('shows help message when no stores exist', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    await handleStores();

    expect(consoleLogSpy).toHaveBeenCalledWith('No stores found.');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('add-repo'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('add-folder'));
  });
});

describe('Commands - handleSuggest', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const { createServices } = await import('../services/index.js');

    mockServices = {
      store: {
        list: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.clearAllMocks(); // Don't restore all mocks, just clear call history
  });

  it('exits on analysis error', async () => {
    const { DependencyUsageAnalyzer } = await import('../analysis/dependency-usage-analyzer.js');

    DependencyUsageAnalyzer.prototype.analyze = vi.fn().mockResolvedValue({
      success: false,
      error: new Error('Analysis failed'),
    });

    try {
      await handleSuggest();
    } catch {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Analysis failed');
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('shows message when no dependencies found', async () => {
    const { DependencyUsageAnalyzer } = await import('../analysis/dependency-usage-analyzer.js');

    DependencyUsageAnalyzer.prototype.analyze = vi.fn().mockResolvedValue({
      success: true,
      data: {
        usages: [],
        totalFilesScanned: 10,
        skippedFiles: 0,
        analysisTimeMs: 100,
      },
    });

    await handleSuggest();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('No external dependencies found')
    );
  });

  it('filters out packages already in stores', async () => {
    const { DependencyUsageAnalyzer } = await import('../analysis/dependency-usage-analyzer.js');
    const { RepoUrlResolver } = await import('../analysis/repo-url-resolver.js');

    DependencyUsageAnalyzer.prototype.analyze = vi.fn().mockResolvedValue({
      success: true,
      data: {
        usages: [
          {
            packageName: 'react',
            importCount: 50,
            fileCount: 10,
            files: [],
            isDevDependency: false,
          },
          {
            packageName: 'lodash',
            importCount: 30,
            fileCount: 5,
            files: [],
            isDevDependency: false,
          },
        ],
        totalFilesScanned: 20,
        skippedFiles: 0,
        analysisTimeMs: 200,
      },
    });

    RepoUrlResolver.prototype.findRepoUrl = vi.fn().mockResolvedValue({
      url: 'https://github.com/lodash/lodash',
      confidence: 'high',
      source: 'registry',
    });

    vi.mocked(mockServices.store.list).mockResolvedValue([
      {
        id: 'store-1',
        name: 'react',
        type: 'repo',
        path: '/tmp/react',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await handleSuggest();

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('lodash'));
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('react'));
  });

  it('shows message when all dependencies already indexed', async () => {
    const { DependencyUsageAnalyzer } = await import('../analysis/dependency-usage-analyzer.js');

    DependencyUsageAnalyzer.prototype.analyze = vi.fn().mockResolvedValue({
      success: true,
      data: {
        usages: [
          {
            packageName: 'react',
            importCount: 50,
            fileCount: 10,
            files: [],
            isDevDependency: false,
          },
        ],
        totalFilesScanned: 20,
        skippedFiles: 0,
        analysisTimeMs: 200,
      },
    });

    vi.mocked(mockServices.store.list).mockResolvedValue([
      {
        id: 'store-1',
        name: 'react',
        type: 'repo',
        path: '/tmp/react',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await handleSuggest();

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('All dependencies are already in knowledge stores')
    );
  });

  it('displays top 5 suggestions with repo URLs', async () => {
    const { DependencyUsageAnalyzer } = await import('../analysis/dependency-usage-analyzer.js');
    const { RepoUrlResolver } = await import('../analysis/repo-url-resolver.js');

    DependencyUsageAnalyzer.prototype.analyze = vi.fn().mockResolvedValue({
      success: true,
      data: {
        usages: [
          {
            packageName: 'react',
            importCount: 100,
            fileCount: 20,
            files: [],
            isDevDependency: false,
          },
          {
            packageName: 'lodash',
            importCount: 80,
            fileCount: 15,
            files: [],
            isDevDependency: false,
          },
        ],
        totalFilesScanned: 30,
        skippedFiles: 0,
        analysisTimeMs: 300,
      },
    });

    RepoUrlResolver.prototype.findRepoUrl = vi.fn().mockResolvedValue({
      url: 'https://github.com/facebook/react',
      confidence: 'high',
      source: 'registry',
    });

    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    await handleSuggest();

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('react'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('100 imports'));
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://github.com/facebook/react')
    );
  });
});
