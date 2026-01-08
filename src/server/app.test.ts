import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './app.js';
import type { ServiceContainer } from '../services/index.js';
import type { Store } from '../types/store.js';
import { createStoreId } from '../types/brands.js';

describe('Server App - Health Check', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
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
  });

  it('returns 200 on health check', async () => {
    const app = createApp(mockServices);

    const res = await app.request('/health');

    expect(res.status).toBe(200);
  });

  it('returns ok status in JSON', async () => {
    const app = createApp(mockServices);

    const res = await app.request('/health');
    const json = await res.json();

    expect(json).toEqual({ status: 'ok' });
  });
});

describe('Server App - CORS', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        list: vi.fn(),
      },
      lance: {},
      search: {},
      index: {},
    } as unknown as ServiceContainer;
  });

  it('includes CORS headers on all routes', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    const res = await app.request('/api/stores');

    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('handles OPTIONS preflight requests', async () => {
    const app = createApp(mockServices);

    const res = await app.request('/api/stores', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
        Origin: 'http://localhost:3000',
      },
    });

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });
});

describe('Server App - GET /api/stores', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        list: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('returns all stores', async () => {
    const mockStores: Store[] = [
      {
        id: createStoreId('store-1'),
        name: 'test-store',
        type: 'file',
        path: '/tmp/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(mockServices.store.list).mockResolvedValue(mockStores);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: 'store-1',
      name: 'test-store',
      type: 'file',
    });
  });

  it('returns empty array when no stores', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual([]);
  });
});

describe('Server App - POST /api/stores', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        create: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('creates file store successfully', async () => {
    const newStore: Store = {
      id: createStoreId('new-store'),
      name: 'new-store',
      type: 'file',
      path: '/tmp/new',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: newStore,
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'new-store',
        type: 'file',
        path: '/tmp/new',
      }),
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toMatchObject({
      id: 'new-store',
      name: 'new-store',
      type: 'file',
    });
  });

  it('creates repo store successfully', async () => {
    const newStore: Store = {
      id: createStoreId('repo-store'),
      name: 'repo-store',
      type: 'repo',
      path: '/tmp/repo',
      url: 'https://github.com/user/repo.git',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: newStore,
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'repo-store',
        type: 'repo',
        url: 'https://github.com/user/repo.git',
      }),
    });

    expect(res.status).toBe(201);
  });

  it('returns 400 on store creation failure', async () => {
    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: false,
      error: new Error('Invalid path'),
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'bad-store',
        type: 'file',
        path: '/invalid',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'Invalid path',
    });
  });

  it('returns 400 when file store missing path', async () => {
    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'bad-file-store',
        type: 'file',
        // missing path
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Missing required field');
  });

  it('returns 400 when web store missing url', async () => {
    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'bad-web-store',
        type: 'web',
        // missing url
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Missing required field');
  });

  it('returns 400 when repo store missing both path and url', async () => {
    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'bad-repo-store',
        type: 'repo',
        // missing both path and url
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Missing required field');
  });

  it('creates web store successfully', async () => {
    const newStore: Store = {
      id: createStoreId('web-store'),
      name: 'web-store',
      type: 'web',
      url: 'https://example.com',
      depth: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: newStore,
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'web-store',
        type: 'web',
        url: 'https://example.com',
      }),
    });

    expect(res.status).toBe(201);
  });
});

describe('Server App - GET /api/stores/:id', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('returns store by id', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/store-1');
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      id: 'store-1',
      name: 'test-store',
    });
  });

  it('returns store by name', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'my-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/my-store');

    expect(res.status).toBe(200);
  });

  it('returns 404 when store not found', async () => {
    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/nonexistent');

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'Not found',
    });
  });
});

describe('Server App - DELETE /api/stores/:id', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
        delete: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('deletes store successfully', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.store.delete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/store-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      deleted: true,
    });
  });

  it('returns 404 when deleting nonexistent store', async () => {
    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/nonexistent', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 on deletion failure', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.store.delete).mockResolvedValue({
      success: false,
      error: new Error('Deletion failed'),
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/store-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'Deletion failed',
    });
  });
});

describe('Server App - POST /api/search', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        list: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
      search: {
        search: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('searches with query', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([
      {
        id: createStoreId('store-1'),
        name: 'test',
        type: 'file',
        path: '/tmp/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'test query',
      }),
    });

    expect(res.status).toBe(200);
    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'test query',
      })
    );
  });

  it('initializes all stores before search', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([
      {
        id: createStoreId('store-1'),
        name: 'test1',
        type: 'file',
        path: '/tmp/test1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: createStoreId('store-2'),
        name: 'test2',
        type: 'file',
        path: '/tmp/test2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    const app = createApp(mockServices);
    await app.request('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'test',
      }),
    });

    expect(mockServices.lance.initialize).toHaveBeenCalledTimes(2);
    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-2'));
  });

  it('uses provided stores list', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([
      {
        id: createStoreId('store-1'),
        name: 'test',
        type: 'file',
        path: '/tmp/test',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    const app = createApp(mockServices);
    await app.request('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'test',
        stores: [createStoreId('custom-store')],
      }),
    });

    expect(mockServices.search.search).toHaveBeenCalledWith(
      expect.objectContaining({
        stores: [createStoreId('custom-store')],
      })
    );
  });

  it('returns search results', async () => {
    vi.mocked(mockServices.store.list).mockResolvedValue([]);
    vi.mocked(mockServices.search.search).mockResolvedValue({
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
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'test',
      }),
    });

    const json = await res.json();
    expect(json.totalResults).toBe(1);
    expect(json.results).toHaveLength(1);
  });
});

describe('Server App - POST /api/stores/:id/index', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        getByIdOrName: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('indexes store successfully', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: {
        documentsIndexed: 10,
        chunksCreated: 50,
        timeMs: 1000,
      },
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/store-1/index', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      documentsIndexed: 10,
      chunksCreated: 50,
      timeMs: 1000,
    });
  });

  it('initializes Lance store before indexing', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: {
        documentsIndexed: 0,
        chunksCreated: 0,
        timeMs: 0,
      },
    });

    const app = createApp(mockServices);
    await app.request('/api/stores/store-1/index', {
      method: 'POST',
    });

    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
  });

  it('returns 404 when store not found', async () => {
    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/nonexistent/index', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 on indexing failure', async () => {
    const mockStore: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(mockStore);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: false,
      error: new Error('Indexing failed'),
    });

    const app = createApp(mockServices);
    const res = await app.request('/api/stores/store-1/index', {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toMatchObject({
      error: 'Indexing failed',
    });
  });
});
