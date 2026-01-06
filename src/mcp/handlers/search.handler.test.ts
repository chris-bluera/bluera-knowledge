import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { handleSearch, handleGetFullContext, resultCache } from './search.handler.js';
import type { HandlerContext } from '../types.js';
import type { ServiceContainer } from '../../services/index.js';

/**
 * Extract JSON from search response that includes a header line.
 * Format: "Search: ... | Results: ... | ~X tokens | Xms\n\n{json}"
 */
function parseSearchResponse(text: string): { header: string; json: Record<string, unknown> } {
  const parts = text.split('\n\n');
  const header = parts[0] ?? '';
  const jsonStr = parts.slice(1).join('\n\n');
  return {
    header,
    json: JSON.parse(jsonStr || '{}')
  };
}

describe('Search Handlers', () => {
  let mockContext: HandlerContext;
  let mockServices: ServiceContainer;

  beforeEach(() => {
    // Clear result cache before each test
    resultCache.clear();

    // Create mock services
    mockServices = {
      store: {
        list: vi.fn().mockResolvedValue([
          { id: 'store1', name: 'Test Store', type: 'file' }
        ]),
        getByIdOrName: vi.fn().mockResolvedValue({
          id: 'store1',
          name: 'Test Store',
          type: 'file',
          path: '/test/path'
        })
      },
      lance: {
        initialize: vi.fn().mockResolvedValue(undefined)
      },
      search: {
        search: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'doc1',
              score: 0.95,
              content: 'test content for search',
              metadata: { storeId: 'store1' },
              summary: { file: 'test.ts', line: 1 }
            }
          ],
          totalResults: 1,
          mode: 'hybrid',
          timeMs: 50
        })
      }
    } as unknown as ServiceContainer;

    mockContext = {
      services: mockServices,
      options: {}
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSearch', () => {
    it('should search across all stores when no stores specified', async () => {
      const result = await handleSearch(
        { query: 'test query', detail: 'minimal', limit: 10 },
        mockContext
      );

      expect(mockServices.store.list).toHaveBeenCalled();
      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          stores: ['store1']
        })
      );

      const { header, json: response } = parseSearchResponse(result.content[0]?.text ?? '');
      expect(header).toContain('Search: "test query"');
      expect(header).toContain('Results: 1');
      expect(header).toContain('tokens');
      expect(response.results).toHaveLength(1);
      expect(response.totalResults).toBe(1);
    });

    it('should use specified stores', async () => {
      await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10, stores: ['store1'] },
        mockContext
      );

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store1');
    });

    it('should throw if store not found', async () => {
      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

      await expect(
        handleSearch(
          { query: 'test', detail: 'minimal', limit: 10, stores: ['nonexistent'] },
          mockContext
        )
      ).rejects.toThrow('Store not found');
    });

    it('should initialize all stores', async () => {
      await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      expect(mockServices.lance.initialize).toHaveBeenCalledWith('store1');
    });

    it('should throw on store initialization error', async () => {
      vi.mocked(mockServices.lance.initialize).mockRejectedValue(
        new Error('Lance initialization failed')
      );

      await expect(
        handleSearch(
          { query: 'test', detail: 'minimal', limit: 10 },
          mockContext
        )
      ).rejects.toThrow('Failed to initialize vector stores');
    });

    it('should cache search results', async () => {
      await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      // Verify cache was populated
      const cached = resultCache.get('doc1');
      expect(cached).toBeDefined();
      expect(cached?.id).toBe('doc1');
    });

    it('should show token count in header', async () => {
      const result = await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      const { header } = parseSearchResponse(result.content[0]?.text ?? '');
      // Header should contain token count (either "~X tokens" or "~X.Xk tokens")
      expect(header).toMatch(/~\d+\.?\d*k? tokens/);
    });

    it('should add repoRoot for repo stores', async () => {
      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue({
        id: 'store1',
        name: 'Test Repo',
        type: 'repo',
        path: '/repos/test',
        createdAt: new Date(),
        updatedAt: new Date(),
        status: 'ready',
        description: 'Test'
      });

      const result = await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      const { json: response } = parseSearchResponse(result.content[0]?.text ?? '');
      expect(response.results[0]?.summary.repoRoot).toBe('/repos/test');
    });

    it('should not add repoRoot for file stores', async () => {
      const result = await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      const { json: response } = parseSearchResponse(result.content[0]?.text ?? '');
      expect(response.results[0]?.summary.repoRoot).toBeUndefined();
    });

    it('should include storeName in results', async () => {
      const result = await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      const { json: response } = parseSearchResponse(result.content[0]?.text ?? '');
      expect(response.results[0]?.summary.storeName).toBe('Test Store');
    });

    it('should include search metadata in response', async () => {
      const result = await handleSearch(
        { query: 'test', detail: 'minimal', limit: 10 },
        mockContext
      );

      const { header, json: response } = parseSearchResponse(result.content[0]?.text ?? '');
      expect(response).toHaveProperty('totalResults', 1);
      expect(response).toHaveProperty('mode', 'hybrid');
      expect(response).toHaveProperty('timeMs', 50);
      // Token count is now in header, not in JSON
      expect(header).toContain('tokens');
    });
  });

  describe('handleGetFullContext', () => {
    beforeEach(() => {
      // Seed cache with a result
      resultCache.set('doc1', {
        id: 'doc1',
        score: 0.95,
        content: 'test content for get full context',
        metadata: { storeId: 'store1', docId: 'doc1' },
        summary: { file: 'test.ts', line: 1 }
      });
    });

    it('should return cached result if already full', async () => {
      // Set up cache with full result
      resultCache.set('doc1', {
        id: 'doc1',
        score: 0.95,
        content: 'test content',
        metadata: { storeId: 'store1', docId: 'doc1' },
        summary: { file: 'test.ts', line: 1 },
        full: { code: 'full code here' }
      });

      const result = await handleGetFullContext(
        { resultId: 'doc1' },
        mockContext
      );

      const response = JSON.parse(result.content[0]?.text ?? '{}');
      expect(response.id).toBe('doc1');
      expect(response.full).toBeDefined();
      expect(response.full.code).toBe('full code here');

      // Should not create services or search again
      expect(mockServices.store.getByIdOrName).not.toHaveBeenCalled();
    });

    it('should throw if result not in cache', async () => {
      await expect(
        handleGetFullContext(
          { resultId: 'nonexistent' },
          mockContext
        )
      ).rejects.toThrow('Result not found in cache');
    });

    it('should re-query for full context if not already full', async () => {
      vi.mocked(mockServices.search.search).mockResolvedValue({
        results: [
          {
            id: 'doc1',
            score: 0.95,
            content: 'test content',
            metadata: { storeId: 'store1', docId: 'doc1' },
            summary: { file: 'test.ts', line: 1 },
            full: { code: 'full code from re-query' }
          }
        ],
        totalResults: 1,
        mode: 'hybrid',
        timeMs: 50
      });

      const result = await handleGetFullContext(
        { resultId: 'doc1' },
        mockContext
      );

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('store1');
      expect(mockServices.lance.initialize).toHaveBeenCalledWith('store1');
      expect(mockServices.search.search).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: 'full',
          limit: 1
        })
      );

      const response = JSON.parse(result.content[0]?.text ?? '{}');
      expect(response.full?.code).toBe('full code from re-query');
    });

    it('should throw if store not found', async () => {
      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

      await expect(
        handleGetFullContext(
          { resultId: 'doc1' },
          mockContext
        )
      ).rejects.toThrow('Store not found');
    });

    it('should return cached result with warning if re-query fails', async () => {
      vi.mocked(mockServices.search.search).mockResolvedValue({
        results: [], // No matching result found
        totalResults: 0,
        mode: 'hybrid',
        timeMs: 50
      });

      const result = await handleGetFullContext(
        { resultId: 'doc1' },
        mockContext
      );

      const response = JSON.parse(result.content[0]?.text ?? '{}');
      expect(response.id).toBe('doc1');
      expect(response.warning).toContain('Could not retrieve full context');
    });

    it('should update cache with full result after re-query', async () => {
      vi.mocked(mockServices.search.search).mockResolvedValue({
        results: [
          {
            id: 'doc1',
            score: 0.95,
            content: 'test content',
            metadata: { storeId: 'store1', docId: 'doc1' },
            summary: { file: 'test.ts', line: 1 },
            full: { code: 'full code from re-query' }
          }
        ],
        totalResults: 1,
        mode: 'hybrid',
        timeMs: 50
      });

      await handleGetFullContext(
        { resultId: 'doc1' },
        mockContext
      );

      const cached = resultCache.get('doc1');
      expect(cached?.full).toBeDefined();
      expect(cached?.full?.code).toBe('full code from re-query');
    });
  });
});
