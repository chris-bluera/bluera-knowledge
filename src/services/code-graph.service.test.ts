import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodeGraphService } from './code-graph.service.js';
import { createStoreId } from '../types/brands.js';

describe('CodeGraphService', () => {
  let tempDir: string;
  let service: CodeGraphService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'code-graph-test-'));
    service = new CodeGraphService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('buildGraph', () => {
    it('should build a graph from TypeScript files', () => {
      const files = [
        {
          path: '/src/utils.ts',
          content: `
export function helper() {
  return 'help';
}

export function doWork() {
  helper();
  return 'done';
}
`
        }
      ];

      const graph = service.buildGraph(files);
      const nodes = graph.getAllNodes();

      expect(nodes.length).toBe(2);
      expect(nodes.some(n => n.name === 'helper')).toBe(true);
      expect(nodes.some(n => n.name === 'doWork')).toBe(true);
    });

    it('should track function calls', () => {
      const files = [
        {
          path: '/src/main.ts',
          content: `
function caller() {
  callee();
}

function callee() {
  return 42;
}
`
        }
      ];

      const graph = service.buildGraph(files);

      // Check that caller calls callee
      const callerEdges = graph.getEdges('/src/main.ts:caller');
      const callsCallee = callerEdges.some(e => e.to.includes('callee') && e.type === 'calls');
      expect(callsCallee).toBe(true);
    });

    it('should track imports', () => {
      const files = [
        {
          path: '/src/consumer.ts',
          content: `
import { helper } from './utils.js';

function useHelper() {
  helper();
}
`
        }
      ];

      const graph = service.buildGraph(files);
      const consumerEdges = graph.getEdges('/src/consumer.ts');
      const hasImport = consumerEdges.some(e => e.type === 'imports');
      expect(hasImport).toBe(true);
    });

    it('should skip non-TypeScript/JavaScript files', () => {
      const files = [
        { path: '/src/readme.md', content: '# README\n\nThis is docs.' },
        { path: '/src/config.json', content: '{"key": "value"}' },
        { path: '/src/main.ts', content: 'export function main() {}' }
      ];

      const graph = service.buildGraph(files);
      const nodes = graph.getAllNodes();

      // Only the .ts file should have nodes
      expect(nodes.length).toBe(1);
      expect(nodes[0].name).toBe('main');
    });
  });

  describe('saveGraph / loadGraph', () => {
    it('should save and load a graph', async () => {
      const storeId = createStoreId('test-store');
      const files = [
        {
          path: '/src/utils.ts',
          content: `
export function helper() {
  return 'help';
}
`
        }
      ];

      const graph = service.buildGraph(files);
      await service.saveGraph(storeId, graph);

      // Clear cache to force load from disk
      service.clearCache();

      const loadedGraph = await service.loadGraph(storeId);
      expect(loadedGraph).not.toBeUndefined();

      const nodes = loadedGraph!.getAllNodes();
      expect(nodes.length).toBe(1);
      expect(nodes[0].name).toBe('helper');
    });

    it('should return undefined for non-existent graph', async () => {
      const storeId = createStoreId('non-existent');
      const graph = await service.loadGraph(storeId);
      expect(graph).toBeUndefined();
    });

    it('should cache loaded graphs', async () => {
      const storeId = createStoreId('cached-store');
      const files = [
        { path: '/src/main.ts', content: 'export function main() {}' }
      ];

      const graph = service.buildGraph(files);
      await service.saveGraph(storeId, graph);

      // Load twice - second should come from cache
      const loaded1 = await service.loadGraph(storeId);
      const loaded2 = await service.loadGraph(storeId);

      // Should be the same instance from cache
      expect(loaded1).toBe(loaded2);
    });

    it('should persist graph to JSON file', async () => {
      const storeId = createStoreId('persisted-store');
      const files = [
        { path: '/src/main.ts', content: 'export function main() {}' }
      ];

      const graph = service.buildGraph(files);
      await service.saveGraph(storeId, graph);

      // Check file exists
      const graphPath = join(tempDir, 'graphs', `${storeId}.json`);
      const content = await readFile(graphPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.nodes).toBeDefined();
      expect(parsed.edges).toBeDefined();
      expect(parsed.nodes.length).toBe(1);
    });
  });

  describe('getUsageStats', () => {
    it('should return calledBy and calls counts', () => {
      const files = [
        {
          path: '/src/main.ts',
          content: `
function caller() {
  target();
}

function target() {
  return 1;
}
`
        }
      ];

      const graph = service.buildGraph(files);

      // target is called by caller
      const targetStats = service.getUsageStats(graph, '/src/main.ts', 'target');
      expect(targetStats.calledBy).toBeGreaterThanOrEqual(1);

      // caller has outgoing calls
      const callerStats = service.getUsageStats(graph, '/src/main.ts', 'caller');
      expect(callerStats.calls).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRelatedCode', () => {
    it('should return callers and callees', () => {
      const files = [
        {
          path: '/src/main.ts',
          content: `
function caller() {
  target();
}

function target() {
  callee();
}

function callee() {
  return 1;
}
`
        }
      ];

      const graph = service.buildGraph(files);
      const related = service.getRelatedCode(graph, '/src/main.ts', 'target');

      // target is called by caller (and possibly itself due to regex-based detection)
      const callers = related.filter(r => r.relationship === 'calls this');
      expect(callers.length).toBeGreaterThanOrEqual(1);
      expect(callers.some(c => c.id.includes('caller'))).toBe(true);

      // target calls callee
      const callees = related.filter(r => r.relationship === 'called by this');
      expect(callees.length).toBeGreaterThanOrEqual(1);
      expect(callees.some(c => c.id.includes('callee'))).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear cached graphs', async () => {
      const storeId = createStoreId('cache-test');
      const files = [
        { path: '/src/main.ts', content: 'export function main() {}' }
      ];

      const graph = service.buildGraph(files);
      await service.saveGraph(storeId, graph);

      // Load to populate cache
      const loaded1 = await service.loadGraph(storeId);

      // Clear cache
      service.clearCache();

      // Load again - should be different instance
      const loaded2 = await service.loadGraph(storeId);

      expect(loaded1).not.toBe(loaded2);
    });
  });
});
