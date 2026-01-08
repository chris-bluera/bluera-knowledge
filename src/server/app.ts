import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { createStoreId } from '../types/brands.js';
import type { ServiceContainer } from '../services/index.js';
import type { SearchQuery } from '../types/search.js';

// HTTP API validation schemas (consistent with MCP schemas)
const CreateStoreBodySchema = z
  .object({
    name: z.string().min(1, 'Store name must be a non-empty string'),
    type: z.enum(['file', 'repo', 'web']),
    path: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    branch: z.string().optional(),
    depth: z.number().int().positive().optional(),
  })
  .refine(
    (data) => {
      switch (data.type) {
        case 'file':
          return data.path !== undefined;
        case 'web':
          return data.url !== undefined;
        case 'repo':
          return data.path !== undefined || data.url !== undefined;
      }
    },
    {
      message:
        'Missing required field: file stores need path, web stores need url, repo stores need path or url',
    }
  );

const SearchBodySchema = z.object({
  query: z.string().min(1, 'Query must be a non-empty string'),
  detail: z.enum(['minimal', 'contextual', 'full']).optional(),
  limit: z.number().int().positive().optional(),
  stores: z.array(z.string()).optional(),
});

export function createApp(services: ServiceContainer): Hono {
  const app = new Hono();

  app.use('*', cors());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Stores
  app.get('/api/stores', async (c) => {
    const stores = await services.store.list();
    return c.json(stores);
  });

  app.post('/api/stores', async (c) => {
    const jsonData: unknown = await c.req.json();
    const parseResult = CreateStoreBodySchema.safeParse(jsonData);
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid request body' }, 400);
    }
    const result = await services.store.create(parseResult.data);
    if (result.success) {
      return c.json(result.data, 201);
    }
    return c.json({ error: result.error.message }, 400);
  });

  app.get('/api/stores/:id', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);
    return c.json(store);
  });

  app.delete('/api/stores/:id', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);
    const result = await services.store.delete(store.id);
    if (result.success) return c.json({ deleted: true });
    return c.json({ error: result.error.message }, 400);
  });

  // Search
  app.post('/api/search', async (c) => {
    const jsonData: unknown = await c.req.json();
    const parseResult = SearchBodySchema.safeParse(jsonData);
    if (!parseResult.success) {
      return c.json({ error: parseResult.error.issues[0]?.message ?? 'Invalid request body' }, 400);
    }

    const storeIds = (await services.store.list()).map((s) => s.id);

    for (const id of storeIds) {
      await services.lance.initialize(id);
    }

    // Convert user-provided store strings to StoreIds, or use all stores
    const requestedStores =
      parseResult.data.stores !== undefined
        ? parseResult.data.stores.map((s) => createStoreId(s))
        : storeIds;

    const query: SearchQuery = {
      query: parseResult.data.query,
      detail: parseResult.data.detail ?? 'minimal',
      limit: parseResult.data.limit ?? 10,
      stores: requestedStores,
    };
    const results = await services.search.search(query);
    return c.json(results);
  });

  // Index
  app.post('/api/stores/:id/index', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);

    await services.lance.initialize(store.id);
    const result = await services.index.indexStore(store);

    if (result.success) return c.json(result.data);
    return c.json({ error: result.error.message }, 400);
  });

  return app;
}
