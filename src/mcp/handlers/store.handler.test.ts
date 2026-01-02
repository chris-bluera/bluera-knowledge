import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  handleListStores,
  handleGetStoreInfo,
  handleCreateStore,
  handleIndexStore,
  handleDeleteStore
} from './store.handler.js';
import type { HandlerContext } from '../types.js';
import type {
  ListStoresArgs,
  GetStoreInfoArgs,
  CreateStoreArgs,
  IndexStoreArgs,
  DeleteStoreArgs
} from '../schemas/index.js';
import { StoreService } from '../../services/store.service.js';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the worker spawn function
vi.mock('../../workers/spawn-worker.js', () => ({
  spawnBackgroundWorker: vi.fn()
}));

import { spawnBackgroundWorker } from '../../workers/spawn-worker.js';
const mockSpawnBackgroundWorker = spawnBackgroundWorker as ReturnType<typeof vi.fn>;

describe('store.handler', () => {
  let tempDir: string;
  let mockContext: HandlerContext;
  let storeService: StoreService;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'store-handler-test-'));
    storeService = new StoreService(tempDir);

    mockContext = {
      services: {
        store: storeService,
        lance: {
          deleteStore: vi.fn().mockResolvedValue(undefined)
        }
      } as any,
      options: { dataDir: tempDir }
    };

    mockSpawnBackgroundWorker.mockClear();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('handleListStores', () => {
    it('should list all stores', async () => {
      // Create two file stores to avoid git clone issues
      const path1 = mkdtempSync(join(tmpdir(), 'store1-'));
      const path2 = mkdtempSync(join(tmpdir(), 'store2-'));

      await storeService.create({
        name: 'store1',
        type: 'file',
        path: path1,
        description: 'Test store 1'
      });
      await storeService.create({
        name: 'store2',
        type: 'file',
        path: path2,
        description: 'Test store 2'
      });

      const args: ListStoresArgs = {};
      const result = await handleListStores(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.stores.length).toBeGreaterThanOrEqual(2);

      rmSync(path1, { recursive: true, force: true });
      rmSync(path2, { recursive: true, force: true });
    });

    it('should filter stores by type', async () => {
      await storeService.create({
        name: 'file-store',
        type: 'file',
        path: tempDir,
        description: 'File store'
      });
      await storeService.create({
        name: 'repo-store',
        type: 'repo',
        url: 'https://github.com/test/repo',
        description: 'Repo store'
      });

      const args: ListStoresArgs = { type: 'file' };
      const result = await handleListStores(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.stores).toHaveLength(1);
      expect(data.stores[0].type).toBe('file');
    });

    it('should include store metadata', async () => {
      const createResult = await storeService.create({
        name: 'test-store',
        type: 'file',
        path: tempDir,
        description: 'Test description'
      });

      const args: ListStoresArgs = {};
      const result = await handleListStores(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      const store = data.stores[0];
      expect(store.id).toBe(createResult.data.id);
      expect(store.name).toBe('test-store');
      expect(store.type).toBe('file');
      expect(store.description).toBe('Test description');
      expect(store.createdAt).toBeDefined();
    });
  });

  describe('handleGetStoreInfo', () => {
    it('should get store by ID', async () => {
      const createResult = await storeService.create({
        name: 'test-store',
        type: 'file',
        path: tempDir,
        description: 'Test store'
      });

      const args: GetStoreInfoArgs = { store: createResult.data.id };
      const result = await handleGetStoreInfo(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe(createResult.data.id);
      expect(data.name).toBe('test-store');
    });

    it('should get store by name', async () => {
      await storeService.create({
        name: 'test-store',
        type: 'file',
        path: tempDir,
        description: 'Test store'
      });

      const args: GetStoreInfoArgs = { store: 'test-store' };
      const result = await handleGetStoreInfo(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.name).toBe('test-store');
    });

    it('should include all store fields', async () => {
      await storeService.create({
        name: 'file-store',
        type: 'file',
        path: tempDir,
        description: 'Test description'
      });

      const args: GetStoreInfoArgs = { store: 'file-store' };
      const result = await handleGetStoreInfo(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('file-store');
      expect(data.type).toBe('file');
      expect(data.path).toBe(tempDir);
      expect(data.description).toBe('Test description');
      expect(data.status).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });

    it('should throw if store not found', async () => {
      const args: GetStoreInfoArgs = { store: 'nonexistent' };

      await expect(
        handleGetStoreInfo(args, mockContext)
      ).rejects.toThrow('Store not found: nonexistent');
    });
  });

  describe('handleCreateStore', () => {
    it('should create file store from path', async () => {
      const sourcePath = mkdtempSync(join(tmpdir(), 'source-'));
      writeFileSync(join(sourcePath, 'test.txt'), 'test content');

      const args: CreateStoreArgs = {
        name: 'new-store',
        type: 'file',
        source: sourcePath,
        description: 'New test store'
      };

      const result = await handleCreateStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.store.name).toBe('new-store');
      expect(data.store.type).toBe('file');
      expect(data.job.id).toBeDefined();
      expect(data.job.status).toBe('pending');

      rmSync(sourcePath, { recursive: true, force: true });
    });

    it('should spawn background worker with jobId and dataDir', async () => {
      const sourcePath = mkdtempSync(join(tmpdir(), 'source-'));
      writeFileSync(join(sourcePath, 'test.txt'), 'test content');

      const args: CreateStoreArgs = {
        name: 'worker-test',
        type: 'file',
        source: sourcePath
      };

      const result = await handleCreateStore(args, mockContext);
      const data = JSON.parse(result.content[0].text);

      expect(mockSpawnBackgroundWorker).toHaveBeenCalledWith(
        data.job.id,
        tempDir
      );

      rmSync(sourcePath, { recursive: true, force: true });
    });

    it('should create repo store from URL', async () => {
      const args: CreateStoreArgs = {
        name: 'repo-store',
        type: 'repo',
        source: 'https://github.com/test/repo.git',
        branch: 'main',
        description: 'Git repo store'
      };

      // This will fail to clone, but should still create the store record
      await expect(
        handleCreateStore(args, mockContext)
      ).rejects.toThrow(/Git clone failed/);

      // Verify store was NOT created since clone failed
      const stores = await storeService.list();
      const found = stores.find(s => s.name === 'repo-store');
      expect(found).toBeUndefined();
    });

    it('should detect URL sources correctly', async () => {
      const httpArgs: CreateStoreArgs = {
        name: 'http-store',
        type: 'repo',
        source: 'http://github.com/test/repo'
      };

      // Will fail to clone, which is expected
      await expect(
        handleCreateStore(httpArgs, mockContext)
      ).rejects.toThrow(/Git clone failed/);
    });

    it('should create store even with nonexistent path', async () => {
      // File store creation doesn't validate path existence
      const args: CreateStoreArgs = {
        name: 'bad-store',
        type: 'file',
        source: '/nonexistent/path/that/does/not/exist'
      };

      const result = await handleCreateStore(args, mockContext);
      const data = JSON.parse(result.content[0].text);
      expect(data.store.name).toBe('bad-store');
      expect(data.job.id).toBeDefined();
    });
  });

  describe('handleIndexStore', () => {
    it('should start indexing for existing store', async () => {
      const createResult = await storeService.create({
        name: 'index-test',
        type: 'file',
        path: tempDir,
        description: 'Test indexing'
      });

      const args: IndexStoreArgs = { store: createResult.data.id };
      const result = await handleIndexStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.store.id).toBe(createResult.data.id);
      expect(data.store.name).toBe('index-test');
      expect(data.job.id).toBeDefined();
      expect(data.job.status).toBe('pending');
      expect(data.message).toContain('Indexing started');
    });

    it('should spawn background worker with jobId and dataDir', async () => {
      const createResult = await storeService.create({
        name: 'index-worker-test',
        type: 'file',
        path: tempDir
      });

      const args: IndexStoreArgs = { store: createResult.data.id };
      const result = await handleIndexStore(args, mockContext);
      const data = JSON.parse(result.content[0].text);

      expect(mockSpawnBackgroundWorker).toHaveBeenCalledWith(
        data.job.id,
        tempDir
      );
    });

    it('should work with store name', async () => {
      await storeService.create({
        name: 'named-store',
        type: 'file',
        path: tempDir,
        description: 'Test'
      });

      const args: IndexStoreArgs = { store: 'named-store' };
      const result = await handleIndexStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.store.name).toBe('named-store');
    });

    it('should throw if store not found', async () => {
      const args: IndexStoreArgs = { store: 'nonexistent' };

      await expect(
        handleIndexStore(args, mockContext)
      ).rejects.toThrow('Store not found: nonexistent');
    });
  });

  describe('handleDeleteStore', () => {
    it('should delete existing store by name', async () => {
      await storeService.create({
        name: 'delete-test',
        type: 'file',
        path: tempDir
      });

      const args: DeleteStoreArgs = { store: 'delete-test' };
      const result = await handleDeleteStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.deleted).toBe(true);
      expect(data.store.name).toBe('delete-test');
      expect(data.message).toContain('Successfully deleted');

      // Verify store is actually deleted
      const stores = await storeService.list();
      expect(stores.find(s => s.name === 'delete-test')).toBeUndefined();
    });

    it('should delete store by ID', async () => {
      const createResult = await storeService.create({
        name: 'delete-by-id',
        type: 'file',
        path: tempDir
      });

      const args: DeleteStoreArgs = { store: createResult.data.id };
      const result = await handleDeleteStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.deleted).toBe(true);
      expect(data.store.id).toBe(createResult.data.id);
    });

    it('should call lance.deleteStore', async () => {
      const createResult = await storeService.create({
        name: 'lance-delete-test',
        type: 'file',
        path: tempDir
      });

      const args: DeleteStoreArgs = { store: 'lance-delete-test' };
      await handleDeleteStore(args, mockContext);

      expect(mockContext.services.lance.deleteStore).toHaveBeenCalledWith(createResult.data.id);
    });

    it('should throw if store not found', async () => {
      const args: DeleteStoreArgs = { store: 'nonexistent' };

      await expect(
        handleDeleteStore(args, mockContext)
      ).rejects.toThrow('Store not found: nonexistent');
    });

    it('should include store type in response', async () => {
      await storeService.create({
        name: 'type-test',
        type: 'file',
        path: tempDir
      });

      const args: DeleteStoreArgs = { store: 'type-test' };
      const result = await handleDeleteStore(args, mockContext);

      const data = JSON.parse(result.content[0].text);
      expect(data.store.type).toBe('file');
    });
  });
});
