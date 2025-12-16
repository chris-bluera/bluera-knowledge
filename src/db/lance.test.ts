import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LanceStore } from './lance.js';
import { createStoreId, createDocumentId } from '../types/brands.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('LanceStore', () => {
  let store: LanceStore;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lance-test-'));
    store = new LanceStore(tempDir);
    await store.initialize(storeId);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('adds and retrieves documents', async () => {
    const doc = {
      id: createDocumentId('doc-1'),
      content: 'Test content',
      vector: new Array(384).fill(0.1),
      metadata: {
        type: 'file' as const,
        storeId,
        indexedAt: new Date(),
        path: '/test/file.txt',
      },
    };

    await store.addDocuments(storeId, [doc]);

    const results = await store.search(storeId, new Array(384).fill(0.1), 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe('doc-1');
  });

  it('deletes documents', async () => {
    const docId = createDocumentId('doc-to-delete');
    const doc = {
      id: docId,
      content: 'Delete me',
      vector: new Array(384).fill(0.2),
      metadata: {
        type: 'file' as const,
        storeId,
        indexedAt: new Date(),
      },
    };

    await store.addDocuments(storeId, [doc]);
    await store.deleteDocuments(storeId, [docId]);

    const results = await store.search(storeId, new Array(384).fill(0.2), 10);
    const found = results.find((r) => r.id === 'doc-to-delete');
    expect(found).toBeUndefined();
  });
});
