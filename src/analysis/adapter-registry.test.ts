import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from './adapter-registry.js';
import type { LanguageAdapter } from './language-adapter.js';
import type { CodeNode, ImportInfo } from './ast-parser.js';
import type { GraphEdge } from './code-graph.js';

/**
 * Mock adapter for testing
 */
function createMockAdapter(overrides: Partial<LanguageAdapter> = {}): LanguageAdapter {
  return {
    languageId: 'test-lang',
    extensions: ['.test'],
    displayName: 'Test Language',
    parse: (): CodeNode[] => [],
    extractImports: (): ImportInfo[] => [],
    ...overrides,
  };
}

describe('AdapterRegistry', () => {
  beforeEach(() => {
    // Reset singleton for each test
    AdapterRegistry.resetInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = AdapterRegistry.getInstance();
      const instance2 = AdapterRegistry.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter();

      registry.register(adapter);

      expect(registry.getByLanguageId('test-lang')).toBe(adapter);
    });

    it('should be idempotent when registering same languageId', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter1 = createMockAdapter();
      const adapter2 = createMockAdapter();

      registry.register(adapter1);
      registry.register(adapter2); // Should not throw, just skip

      // First adapter should still be registered
      expect(registry.getByLanguageId('test-lang')).toBe(adapter1);
      expect(registry.getAllAdapters()).toHaveLength(1);
    });

    it('should throw if extension is already registered by another adapter', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter1 = createMockAdapter({ languageId: 'lang1', extensions: ['.test'] });
      const adapter2 = createMockAdapter({ languageId: 'lang2', extensions: ['.test'] });

      registry.register(adapter1);

      expect(() => registry.register(adapter2)).toThrow(
        'Extension ".test" is already registered by adapter "lang1"'
      );
    });
  });

  describe('getByExtension', () => {
    it('should return adapter by extension', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({ extensions: ['.zil', '.mud'] });

      registry.register(adapter);

      expect(registry.getByExtension('.zil')).toBe(adapter);
      expect(registry.getByExtension('.mud')).toBe(adapter);
    });

    it('should return undefined for unregistered extension', () => {
      const registry = AdapterRegistry.getInstance();

      expect(registry.getByExtension('.unknown')).toBeUndefined();
    });

    it('should normalize extension with leading dot', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({ extensions: ['.zil'] });

      registry.register(adapter);

      // Both with and without dot should work
      expect(registry.getByExtension('.zil')).toBe(adapter);
      expect(registry.getByExtension('zil')).toBe(adapter);
    });
  });

  describe('getByLanguageId', () => {
    it('should return adapter by language ID', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({ languageId: 'zil' });

      registry.register(adapter);

      expect(registry.getByLanguageId('zil')).toBe(adapter);
    });

    it('should return undefined for unregistered language ID', () => {
      const registry = AdapterRegistry.getInstance();

      expect(registry.getByLanguageId('unknown')).toBeUndefined();
    });
  });

  describe('getAllAdapters', () => {
    it('should return empty array when no adapters registered', () => {
      const registry = AdapterRegistry.getInstance();

      expect(registry.getAllAdapters()).toEqual([]);
    });

    it('should return all registered adapters', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter1 = createMockAdapter({ languageId: 'lang1', extensions: ['.l1'] });
      const adapter2 = createMockAdapter({ languageId: 'lang2', extensions: ['.l2'] });

      registry.register(adapter1);
      registry.register(adapter2);

      const adapters = registry.getAllAdapters();
      expect(adapters).toHaveLength(2);
      expect(adapters).toContain(adapter1);
      expect(adapters).toContain(adapter2);
    });
  });

  describe('unregister', () => {
    it('should unregister an adapter by language ID', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({ languageId: 'zil', extensions: ['.zil'] });

      registry.register(adapter);
      expect(registry.getByLanguageId('zil')).toBe(adapter);

      const result = registry.unregister('zil');
      expect(result).toBe(true);
      expect(registry.getByLanguageId('zil')).toBeUndefined();
      expect(registry.getByExtension('.zil')).toBeUndefined();
    });

    it('should return false when unregistering non-existent adapter', () => {
      const registry = AdapterRegistry.getInstance();

      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('hasExtension', () => {
    it('should return true for registered extension', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({ extensions: ['.zil'] });

      registry.register(adapter);

      expect(registry.hasExtension('.zil')).toBe(true);
    });

    it('should return false for unregistered extension', () => {
      const registry = AdapterRegistry.getInstance();

      expect(registry.hasExtension('.unknown')).toBe(false);
    });
  });

  describe('adapter with optional methods', () => {
    it('should support adapters with chunk method', () => {
      const registry = AdapterRegistry.getInstance();
      const adapter = createMockAdapter({
        chunk: () => [{ content: 'test', startLine: 1, endLine: 10 }],
      });

      registry.register(adapter);

      const retrieved = registry.getByLanguageId('test-lang');
      expect(retrieved?.chunk).toBeDefined();
      expect(retrieved?.chunk?.('', '')).toEqual([{ content: 'test', startLine: 1, endLine: 10 }]);
    });

    it('should support adapters with analyzeCallRelationships method', () => {
      const registry = AdapterRegistry.getInstance();
      const mockEdge: GraphEdge = {
        from: 'a',
        to: 'b',
        type: 'calls',
        confidence: 1.0,
      };
      const adapter = createMockAdapter({
        analyzeCallRelationships: () => [mockEdge],
      });

      registry.register(adapter);

      const retrieved = registry.getByLanguageId('test-lang');
      expect(retrieved?.analyzeCallRelationships).toBeDefined();
      expect(retrieved?.analyzeCallRelationships?.('', '')).toEqual([mockEdge]);
    });
  });
});
