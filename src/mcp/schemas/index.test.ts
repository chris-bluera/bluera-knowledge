import { describe, it, expect } from 'vitest';
import {
  SearchArgsSchema,
  GetFullContextArgsSchema,
  ListStoresArgsSchema,
  GetStoreInfoArgsSchema,
  CreateStoreArgsSchema,
  IndexStoreArgsSchema,
  DeleteStoreArgsSchema,
  CheckJobStatusArgsSchema,
  ListJobsArgsSchema,
  CancelJobArgsSchema,
} from './index.js';

describe('MCP Schema Validation', () => {
  describe('SearchArgsSchema', () => {
    it('should validate valid search args', () => {
      const result = SearchArgsSchema.parse({
        query: 'test query',
        detail: 'minimal',
        limit: 10,
      });

      expect(result.query).toBe('test query');
      expect(result.detail).toBe('minimal');
      expect(result.limit).toBe(10);
    });

    it('should use defaults for optional fields', () => {
      const result = SearchArgsSchema.parse({ query: 'test' });

      expect(result.detail).toBe('minimal');
      expect(result.limit).toBe(10);
    });

    it('should reject empty query', () => {
      expect(() => SearchArgsSchema.parse({ query: '' })).toThrow(
        'Query must be a non-empty string'
      );
    });

    it('should validate detail enum', () => {
      expect(() => SearchArgsSchema.parse({ query: 'test', detail: 'invalid' })).toThrow();

      const minimal = SearchArgsSchema.parse({ query: 'test', detail: 'minimal' });
      expect(minimal.detail).toBe('minimal');

      const contextual = SearchArgsSchema.parse({ query: 'test', detail: 'contextual' });
      expect(contextual.detail).toBe('contextual');

      const full = SearchArgsSchema.parse({ query: 'test', detail: 'full' });
      expect(full.detail).toBe('full');
    });

    it('should validate intent enum', () => {
      const result = SearchArgsSchema.parse({
        query: 'test',
        intent: 'find-implementation',
      });

      expect(result.intent).toBe('find-implementation');
    });

    it('should validate stores array', () => {
      const result = SearchArgsSchema.parse({
        query: 'test',
        stores: ['store1', 'store2'],
      });

      expect(result.stores).toEqual(['store1', 'store2']);
    });

    it('should reject invalid limit', () => {
      expect(() => SearchArgsSchema.parse({ query: 'test', limit: -1 })).toThrow();

      expect(() => SearchArgsSchema.parse({ query: 'test', limit: 0 })).toThrow();

      expect(() => SearchArgsSchema.parse({ query: 'test', limit: 1.5 })).toThrow();
    });
  });

  describe('GetFullContextArgsSchema', () => {
    it('should validate valid resultId', () => {
      const result = GetFullContextArgsSchema.parse({ resultId: 'doc123' });
      expect(result.resultId).toBe('doc123');
    });

    it('should reject empty resultId', () => {
      expect(() => GetFullContextArgsSchema.parse({ resultId: '' })).toThrow(
        'Result ID must be a non-empty string'
      );
    });

    it('should reject missing resultId', () => {
      expect(() => GetFullContextArgsSchema.parse({})).toThrow();
    });
  });

  describe('ListStoresArgsSchema', () => {
    it('should validate without type filter', () => {
      const result = ListStoresArgsSchema.parse({});
      expect(result.type).toBeUndefined();
    });

    it('should validate with valid type filter', () => {
      const file = ListStoresArgsSchema.parse({ type: 'file' });
      expect(file.type).toBe('file');

      const repo = ListStoresArgsSchema.parse({ type: 'repo' });
      expect(repo.type).toBe('repo');

      const web = ListStoresArgsSchema.parse({ type: 'web' });
      expect(web.type).toBe('web');
    });

    it('should reject invalid type', () => {
      expect(() => ListStoresArgsSchema.parse({ type: 'invalid' })).toThrow();
    });
  });

  describe('GetStoreInfoArgsSchema', () => {
    it('should validate valid store', () => {
      const result = GetStoreInfoArgsSchema.parse({ store: 'my-store' });
      expect(result.store).toBe('my-store');
    });

    it('should reject empty store', () => {
      expect(() => GetStoreInfoArgsSchema.parse({ store: '' })).toThrow(
        'Store name or ID must be a non-empty string'
      );
    });

    it('should reject missing store', () => {
      expect(() => GetStoreInfoArgsSchema.parse({})).toThrow();
    });
  });

  describe('CreateStoreArgsSchema', () => {
    it('should validate minimal valid args', () => {
      const result = CreateStoreArgsSchema.parse({
        name: 'test-store',
        type: 'file',
        source: '/path/to/source',
      });

      expect(result.name).toBe('test-store');
      expect(result.type).toBe('file');
      expect(result.source).toBe('/path/to/source');
    });

    it('should validate with optional fields', () => {
      const result = CreateStoreArgsSchema.parse({
        name: 'test-repo',
        type: 'repo',
        source: 'https://github.com/test/repo',
        branch: 'main',
        description: 'Test repository',
      });

      expect(result.name).toBe('test-repo');
      expect(result.type).toBe('repo');
      expect(result.source).toBe('https://github.com/test/repo');
      expect(result.branch).toBe('main');
      expect(result.description).toBe('Test repository');
    });

    it('should reject empty name', () => {
      expect(() =>
        CreateStoreArgsSchema.parse({
          name: '',
          type: 'file',
          source: '/path',
        })
      ).toThrow('Store name must be a non-empty string');
    });

    it('should reject invalid type', () => {
      expect(() =>
        CreateStoreArgsSchema.parse({
          name: 'test',
          type: 'invalid',
          source: '/path',
        })
      ).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() =>
        CreateStoreArgsSchema.parse({
          name: 'test',
          type: 'file',
        })
      ).toThrow();

      expect(() =>
        CreateStoreArgsSchema.parse({
          name: 'test',
          source: '/path',
        })
      ).toThrow();

      expect(() =>
        CreateStoreArgsSchema.parse({
          type: 'file',
          source: '/path',
        })
      ).toThrow();
    });
  });

  describe('IndexStoreArgsSchema', () => {
    it('should validate valid store', () => {
      const result = IndexStoreArgsSchema.parse({ store: 'my-store' });
      expect(result.store).toBe('my-store');
    });

    it('should reject empty store', () => {
      expect(() => IndexStoreArgsSchema.parse({ store: '' })).toThrow(
        'Store name or ID must be a non-empty string'
      );
    });

    it('should reject missing store', () => {
      expect(() => IndexStoreArgsSchema.parse({})).toThrow();
    });
  });

  describe('DeleteStoreArgsSchema', () => {
    it('should validate valid store name', () => {
      const result = DeleteStoreArgsSchema.parse({ store: 'my-store' });
      expect(result.store).toBe('my-store');
    });

    it('should validate valid store ID', () => {
      const result = DeleteStoreArgsSchema.parse({ store: 'abc123-def456' });
      expect(result.store).toBe('abc123-def456');
    });

    it('should reject empty store', () => {
      expect(() => DeleteStoreArgsSchema.parse({ store: '' })).toThrow(
        'Store name or ID must be a non-empty string'
      );
    });

    it('should reject missing store', () => {
      expect(() => DeleteStoreArgsSchema.parse({})).toThrow();
    });
  });

  describe('CheckJobStatusArgsSchema', () => {
    it('should validate valid jobId', () => {
      const result = CheckJobStatusArgsSchema.parse({ jobId: 'job_123' });
      expect(result.jobId).toBe('job_123');
    });

    it('should reject empty jobId', () => {
      expect(() => CheckJobStatusArgsSchema.parse({ jobId: '' })).toThrow(
        'Job ID must be a non-empty string'
      );
    });

    it('should reject missing jobId', () => {
      expect(() => CheckJobStatusArgsSchema.parse({})).toThrow();
    });
  });

  describe('ListJobsArgsSchema', () => {
    it('should validate with defaults', () => {
      const result = ListJobsArgsSchema.parse({});
      expect(result.activeOnly).toBeUndefined();
      expect(result.status).toBeUndefined();
    });

    it('should validate activeOnly', () => {
      const active = ListJobsArgsSchema.parse({ activeOnly: true });
      expect(active.activeOnly).toBe(true);

      const all = ListJobsArgsSchema.parse({ activeOnly: false });
      expect(all.activeOnly).toBe(false);
    });

    it('should validate status filter', () => {
      const pending = ListJobsArgsSchema.parse({ status: 'pending' });
      expect(pending.status).toBe('pending');

      const running = ListJobsArgsSchema.parse({ status: 'running' });
      expect(running.status).toBe('running');

      const completed = ListJobsArgsSchema.parse({ status: 'completed' });
      expect(completed.status).toBe('completed');

      const failed = ListJobsArgsSchema.parse({ status: 'failed' });
      expect(failed.status).toBe('failed');

      const cancelled = ListJobsArgsSchema.parse({ status: 'cancelled' });
      expect(cancelled.status).toBe('cancelled');
    });

    it('should reject invalid status', () => {
      expect(() => ListJobsArgsSchema.parse({ status: 'invalid' })).toThrow();
    });
  });

  describe('CancelJobArgsSchema', () => {
    it('should validate valid jobId', () => {
      const result = CancelJobArgsSchema.parse({ jobId: 'job_123' });
      expect(result.jobId).toBe('job_123');
    });

    it('should reject empty jobId', () => {
      expect(() => CancelJobArgsSchema.parse({ jobId: '' })).toThrow(
        'Job ID must be a non-empty string'
      );
    });

    it('should reject missing jobId', () => {
      expect(() => CancelJobArgsSchema.parse({})).toThrow();
    });
  });
});
