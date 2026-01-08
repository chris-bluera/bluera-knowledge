import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from './index.js';
import type { ServiceContainer } from '../services/index.js';
import { createStoreId } from '../types/brands.js';
import type { Store } from '../types/store.js';

describe('Server Integration - Full App Creation', () => {
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

  it('creates app with all routes configured', async () => {
    const app = createApp(mockServices);

    expect(app).toBeDefined();
    expect(typeof app.request).toBe('function');
  });

  it('handles health check endpoint', async () => {
    const app = createApp(mockServices);

    const res = await app.request('/health');

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ status: 'ok' });
  });

  it('handles 404 for unknown routes', async () => {
    const app = createApp(mockServices);

    const res = await app.request('/unknown-route');

    expect(res.status).toBe(404);
  });
});

describe('Server Integration - Store CRUD Flow', () => {
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

  it('completes full CRUD workflow', async () => {
    const app = createApp(mockServices);

    // 1. List stores (empty)
    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    let res = await app.request('/api/stores');
    let json = await res.json();
    expect(json).toEqual([]);

    // 2. Create store
    const newStore: Store = {
      id: createStoreId('new-store'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: true,
      data: newStore,
    });

    res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-store',
        type: 'file',
        path: '/tmp/test',
      }),
    });

    expect(res.status).toBe(201);

    // 3. Get store by ID
    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(newStore);

    res = await app.request('/api/stores/new-store');
    json = await res.json();
    expect(json).toMatchObject({ id: 'new-store', name: 'test-store' });

    // 4. Delete store
    vi.mocked(mockServices.store.delete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    res = await app.request('/api/stores/new-store', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
  });
});

describe('Server Integration - Search Flow', () => {
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

  it('performs search across multiple stores', async () => {
    const app = createApp(mockServices);

    const stores: Store[] = [
      {
        id: createStoreId('store-1'),
        name: 'store1',
        type: 'file',
        path: '/tmp/1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: createStoreId('store-2'),
        name: 'store2',
        type: 'file',
        path: '/tmp/2',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    vi.mocked(mockServices.store.list).mockResolvedValue(stores);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [{ score: 0.9, summary: { location: 'file1.ts', purpose: 'Test' } }],
      totalResults: 1,
    });

    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test query' }),
    });

    expect(res.status).toBe(200);
    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-2'));
  });
});

describe('Server Integration - Index Flow', () => {
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

  it('indexes store after creation', async () => {
    const app = createApp(mockServices);

    const store: Store = {
      id: createStoreId('store-1'),
      name: 'test-store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(store);
    vi.mocked(mockServices.index.indexStore).mockResolvedValue({
      success: true,
      data: {
        documentsIndexed: 5,
        chunksCreated: 25,
        timeMs: 500,
      },
    });

    const res = await app.request('/api/stores/store-1/index', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(mockServices.lance.initialize).toHaveBeenCalledWith(createStoreId('store-1'));
    expect(mockServices.index.indexStore).toHaveBeenCalledWith(store);
  });
});

describe('Server Integration - Error Handling', () => {
  let mockServices: ServiceContainer;

  beforeEach(() => {
    mockServices = {
      store: {
        create: vi.fn(),
        getByIdOrName: vi.fn(),
        delete: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
    } as unknown as ServiceContainer;
  });

  it('handles service errors gracefully', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.create).mockResolvedValue({
      success: false,
      error: new Error('Service error'),
    });

    const res = await app.request('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test',
        type: 'file',
        path: '/tmp/test',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
  });

  it('returns proper error codes for not found resources', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

    const res = await app.request('/api/stores/nonexistent');

    expect(res.status).toBe(404);
  });
});

describe('Server Integration - Content Negotiation', () => {
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

  it('returns JSON by default', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    const res = await app.request('/api/stores');

    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('handles JSON POST bodies', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.list).mockResolvedValue([]);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });

    expect(res.status).toBe(200);
  });
});

describe('Server Integration - Route Parameters', () => {
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

  it('extracts store ID from URL', async () => {
    const app = createApp(mockServices);

    const store: Store = {
      id: createStoreId('my-special-id'),
      name: 'test',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(store);

    await app.request('/api/stores/my-special-id');

    expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('my-special-id');
  });

  it('handles URL-encoded store names', async () => {
    const app = createApp(mockServices);

    const store: Store = {
      id: createStoreId('store-1'),
      name: 'my store',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(store);

    await app.request('/api/stores/my%20store');

    expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('my store');
  });
});

describe('Server Integration - HTTP Methods', () => {
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

  it('supports GET requests', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.list).mockResolvedValue([]);

    const res = await app.request('/api/stores', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
  });

  it('supports POST requests', async () => {
    const app = createApp(mockServices);

    vi.mocked(mockServices.store.list).mockResolvedValue([]);
    vi.mocked(mockServices.search.search).mockResolvedValue({
      results: [],
      totalResults: 0,
    });

    const res = await app.request('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });

    expect(res.status).toBe(200);
  });

  it('supports DELETE requests', async () => {
    const app = createApp(mockServices);

    const store: Store = {
      id: createStoreId('store-1'),
      name: 'test',
      type: 'file',
      path: '/tmp/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(store);
    vi.mocked(mockServices.store.delete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const res = await app.request('/api/stores/store-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
  });
});
