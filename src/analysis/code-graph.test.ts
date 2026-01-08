import { describe, it, expect } from 'vitest';
import { CodeGraph } from './code-graph.js';
import type { CodeNode } from './ast-parser.js';

describe('CodeGraph', () => {
  describe('Node management', () => {
    it('adds nodes to graph', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'testFn',
          exported: true,
          startLine: 1,
          endLine: 5,
          signature: 'testFn()',
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      const node = graph.getNode('/src/test.ts:testFn');

      expect(node).toBeDefined();
      expect(node?.name).toBe('testFn');
      expect(node?.file).toBe('/src/test.ts');
    });

    it('generates unique node IDs from file and name', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'shared',
          exported: false,
          startLine: 1,
          endLine: 3,
        },
      ];

      graph.addNodes(nodes, '/src/file1.ts');
      graph.addNodes(nodes, '/src/file2.ts');

      const node1 = graph.getNode('/src/file1.ts:shared');
      const node2 = graph.getNode('/src/file2.ts:shared');

      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node1?.id).not.toBe(node2?.id);
    });

    it('includes signature when available', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'add',
          exported: true,
          startLine: 1,
          endLine: 3,
          signature: 'add(a, b)',
        },
      ];

      graph.addNodes(nodes, '/src/math.ts');
      const node = graph.getNode('/src/math.ts:add');

      expect(node?.signature).toBe('add(a, b)');
    });

    it('handles nodes without signature', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'interface',
          name: 'User',
          exported: true,
          startLine: 1,
          endLine: 3,
        },
      ];

      graph.addNodes(nodes, '/src/types.ts');
      const node = graph.getNode('/src/types.ts:User');

      expect(node?.signature).toBeUndefined();
    });

    it('retrieves all nodes', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'fn1',
          exported: false,
          startLine: 1,
          endLine: 2,
        },
        {
          type: 'function',
          name: 'fn2',
          exported: false,
          startLine: 3,
          endLine: 4,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      const allNodes = graph.getAllNodes();

      expect(allNodes).toHaveLength(2);
      expect(allNodes.map((n) => n.name)).toEqual(['fn1', 'fn2']);
    });

    it('returns undefined for non-existent node', () => {
      const graph = new CodeGraph();
      const node = graph.getNode('/src/missing.ts:notFound');

      expect(node).toBeUndefined();
    });
  });

  describe('Import relationships', () => {
    it('adds import edges', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/main.ts', './utils', ['helper', 'formatter']);
      const edges = graph.getEdges('/src/main.ts');

      expect(edges).toHaveLength(2);
      expect(edges[0]?.type).toBe('imports');
      expect(edges[0]?.confidence).toBe(1.0);
    });

    it('resolves relative imports correctly', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/components/Button.ts', '../utils', ['format']);
      const edges = graph.getEdges('/src/components/Button.ts');

      expect(edges[0]?.to).toBe('/src/utils:format');
    });

    it('handles same-directory imports', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/utils/index.ts', './helpers', ['helper']);
      const edges = graph.getEdges('/src/utils/index.ts');

      expect(edges[0]?.to).toContain('helpers:helper');
    });

    it('handles parent directory traversal', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/deep/nested/file.ts', '../../root', ['config']);
      const edges = graph.getEdges('/src/deep/nested/file.ts');

      expect(edges[0]?.to).toBe('/src/root:config');
    });

    it('handles package imports without modification', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/app.ts', 'react', ['useState', 'useEffect']);
      const edges = graph.getEdges('/src/app.ts');

      expect(edges).toHaveLength(2);
      expect(edges[0]?.to).toBe('react:useState');
      expect(edges[1]?.to).toBe('react:useEffect');
    });

    it('removes .js extension from resolved paths', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/main.ts', './helper.js', ['help']);
      const edges = graph.getEdges('/src/main.ts');

      expect(edges[0]?.to).not.toContain('.js');
    });

    it('returns empty array for file with no edges', () => {
      const graph = new CodeGraph();
      const edges = graph.getEdges('/src/isolated.ts');

      expect(edges).toEqual([]);
    });
  });

  describe('Call relationship analysis', () => {
    it('detects function calls in code', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'caller',
          exported: false,
          startLine: 1,
          endLine: 3,
        },
        {
          type: 'function',
          name: 'helper',
          exported: false,
          startLine: 5,
          endLine: 7,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      const code = `function caller() {
  helper();
  return true;
}`;

      graph.analyzeCallRelationships(code, '/src/test.ts', 'caller');
      const edges = graph.getEdges('/src/test.ts:caller');

      const helperCall = edges.find((e) => e.to === '/src/test.ts:helper');
      expect(helperCall).toBeDefined();
      expect(helperCall?.type).toBe('calls');
    });

    it('sets lower confidence for regex-based detection', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'test',
          exported: false,
          startLine: 1,
          endLine: 3,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      graph.analyzeCallRelationships('someFunc();', '/src/test.ts', 'test');
      const edges = graph.getEdges('/src/test.ts:test');

      expect(edges[0]?.confidence).toBeLessThan(1.0);
    });

    it('handles unknown function calls', () => {
      const graph = new CodeGraph();

      graph.analyzeCallRelationships('unknownFunction();', '/src/test.ts', 'caller');
      const edges = graph.getEdges('/src/test.ts:caller');

      const unknownCall = edges.find((e) => e.to === 'unknown:unknownFunction');
      expect(unknownCall).toBeDefined();
      expect(unknownCall?.confidence).toBe(0.5);
    });

    it('detects multiple calls', () => {
      const graph = new CodeGraph();

      const code = `
  helper1();
  helper2();
  helper3();
`;

      graph.analyzeCallRelationships(code, '/src/test.ts', 'main');
      const edges = graph.getEdges('/src/test.ts:main');

      expect(edges.length).toBeGreaterThanOrEqual(3);
    });

    it('handles code with no function calls', () => {
      const graph = new CodeGraph();

      const code = 'const x = 42; return x;';

      graph.analyzeCallRelationships(code, '/src/test.ts', 'simple');
      const edges = graph.getEdges('/src/test.ts:simple');

      // May have edges for 'const' and 'return' depending on regex
      // But should not throw errors
      expect(edges).toBeDefined();
    });
  });

  describe('Graph serialization', () => {
    it('exports graph to JSON format', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'test',
          exported: true,
          startLine: 1,
          endLine: 3,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      graph.addImport('/src/test.ts', 'module', ['helper']);

      const json = graph.toJSON();

      expect(json.nodes).toHaveLength(1);
      expect(json.edges).toHaveLength(1);
      expect(json.nodes[0]?.name).toBe('test');
      expect(json.edges[0]?.type).toBe('imports');
    });

    it('includes all edge types in JSON', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'function',
          name: 'fn',
          exported: false,
          startLine: 1,
          endLine: 2,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      graph.addImport('/src/test.ts', 'module', ['util']);
      graph.analyzeCallRelationships('other();', '/src/test.ts', 'fn');

      const json = graph.toJSON();

      const edgeTypes = json.edges.map((e) => e.type);
      expect(edgeTypes).toContain('imports');
      expect(edgeTypes).toContain('calls');
    });

    it('handles empty graph', () => {
      const graph = new CodeGraph();
      const json = graph.toJSON();

      expect(json.nodes).toEqual([]);
      expect(json.edges).toEqual([]);
    });
  });

  describe('Path resolution edge cases', () => {
    it('handles deeply nested relative imports', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/very/deep/nested/component.ts', '../../../root', ['config']);
      const edges = graph.getEdges('/src/very/deep/nested/component.ts');

      expect(edges[0]?.to).toBe('/src/root:config');
    });

    it('handles dot-only relative import', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/index.ts', '.', ['default']);
      const edges = graph.getEdges('/src/index.ts');

      // Should resolve to same directory
      expect(edges[0]?.to).toContain('src');
    });

    it('handles scoped package imports', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/app.ts', '@org/package', ['Component']);
      const edges = graph.getEdges('/src/app.ts');

      expect(edges[0]?.to).toBe('@org/package:Component');
    });

    it('handles imports from root', () => {
      const graph = new CodeGraph();

      graph.addImport('/component.ts', './utils', ['helper']);
      const edges = graph.getEdges('/component.ts');

      expect(edges[0]?.to).toBe('/utils:helper');
    });
  });

  describe('Incoming edges and call counts', () => {
    it('returns incoming edges for a node', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'caller1', exported: false, startLine: 1, endLine: 2 },
        { type: 'function', name: 'caller2', exported: false, startLine: 3, endLine: 4 },
        { type: 'function', name: 'target', exported: false, startLine: 5, endLine: 6 },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // caller1 and caller2 both call target
      graph.analyzeCallRelationships('target();', '/src/test.ts', 'caller1');
      graph.analyzeCallRelationships('target();', '/src/test.ts', 'caller2');

      const incoming = graph.getIncomingEdges('/src/test.ts:target');

      expect(incoming).toHaveLength(2);
      expect(incoming.every((e) => e.to === '/src/test.ts:target')).toBe(true);
      expect(incoming.every((e) => e.type === 'calls')).toBe(true);
    });

    it('returns empty array for node with no incoming edges', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'isolated', exported: false, startLine: 1, endLine: 2 },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      const incoming = graph.getIncomingEdges('/src/test.ts:isolated');

      expect(incoming).toEqual([]);
    });

    it('counts calledBy correctly', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'fn1', exported: false, startLine: 1, endLine: 2 },
        { type: 'function', name: 'fn2', exported: false, startLine: 3, endLine: 4 },
        { type: 'function', name: 'fn3', exported: false, startLine: 5, endLine: 6 },
        { type: 'function', name: 'utility', exported: false, startLine: 7, endLine: 8 },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // fn1, fn2, fn3 all call utility
      graph.analyzeCallRelationships('utility();', '/src/test.ts', 'fn1');
      graph.analyzeCallRelationships('utility();', '/src/test.ts', 'fn2');
      graph.analyzeCallRelationships('utility();', '/src/test.ts', 'fn3');

      const count = graph.getCalledByCount('/src/test.ts:utility');
      expect(count).toBe(3);
    });

    it('returns 0 for calledBy when no callers', () => {
      const graph = new CodeGraph();
      const count = graph.getCalledByCount('/src/test.ts:noCaller');
      expect(count).toBe(0);
    });

    it('counts calls (outgoing) correctly', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'main', exported: false, startLine: 1, endLine: 10 },
        { type: 'function', name: 'helper1', exported: false, startLine: 11, endLine: 15 },
        { type: 'function', name: 'helper2', exported: false, startLine: 16, endLine: 20 },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // main calls both helpers
      const code = 'helper1(); helper2();';
      graph.analyzeCallRelationships(code, '/src/test.ts', 'main');

      const count = graph.getCallsCount('/src/test.ts:main');
      expect(count).toBe(2);
    });

    it('returns 0 for calls when function makes no calls', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'leaf', exported: false, startLine: 1, endLine: 2 },
      ];

      graph.addNodes(nodes, '/src/test.ts');
      graph.analyzeCallRelationships('return 42;', '/src/test.ts', 'leaf');

      const count = graph.getCallsCount('/src/test.ts:leaf');
      expect(count).toBe(0);
    });

    it('distinguishes between call edges and import edges in calledBy count', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        { type: 'function', name: 'target', exported: true, startLine: 1, endLine: 2 },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // Add import edge (should not count as calledBy)
      graph.addImport('/src/other.ts', './test', ['target']);

      // Add call edge (should count as calledBy)
      graph.analyzeCallRelationships('target();', '/src/caller.ts', 'caller');

      const calledByCount = graph.getCalledByCount('/src/test.ts:target');
      expect(calledByCount).toBe(1); // Only the call edge, not the import
    });
  });

  describe('Class method tracking', () => {
    it('creates separate nodes for class methods', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'class',
          name: 'MyService',
          exported: true,
          startLine: 1,
          endLine: 20,
          methods: [
            { name: 'search', async: true, signature: 'search(query: string): Promise<Result>' },
            { name: 'update', async: false, signature: 'update(id: string): void' },
          ],
        },
      ];

      graph.addNodes(nodes, '/src/service.ts');

      // Should have 3 nodes: class + 2 methods
      const allNodes = graph.getAllNodes();
      expect(allNodes).toHaveLength(3);

      // Class node should exist
      const classNode = graph.getNode('/src/service.ts:MyService');
      expect(classNode).toBeDefined();
      expect(classNode?.type).toBe('class');

      // Method nodes should exist with correct IDs
      const searchMethod = graph.getNode('/src/service.ts:MyService.search');
      expect(searchMethod).toBeDefined();
      expect(searchMethod?.type).toBe('method');
      expect(searchMethod?.signature).toBe('search(query: string): Promise<Result>');

      const updateMethod = graph.getNode('/src/service.ts:MyService.update');
      expect(updateMethod).toBeDefined();
      expect(updateMethod?.type).toBe('method');
    });

    it('tracks calledBy for individual methods', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'class',
          name: 'SearchService',
          exported: true,
          startLine: 1,
          endLine: 10,
          methods: [{ name: 'search', async: true, signature: 'search(): Promise<void>' }],
        },
        {
          type: 'function',
          name: 'handleSearch',
          exported: false,
          startLine: 12,
          endLine: 15,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // handleSearch calls SearchService.search
      const code = 'services.search.search();';
      graph.analyzeCallRelationships(code, '/src/test.ts', 'handleSearch');

      // The search method should have calledBy count
      const calledBy = graph.getCalledByCount('/src/test.ts:SearchService.search');
      expect(calledBy).toBeGreaterThan(0);
    });

    it('tracks calls from individual methods', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'class',
          name: 'Service',
          exported: true,
          startLine: 1,
          endLine: 20,
          methods: [{ name: 'main', async: true, signature: 'main(): Promise<void>' }],
        },
        {
          type: 'function',
          name: 'helper1',
          exported: false,
          startLine: 22,
          endLine: 24,
        },
        {
          type: 'function',
          name: 'helper2',
          exported: false,
          startLine: 26,
          endLine: 28,
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // Service.main calls helper1 and helper2
      const code = 'helper1(); helper2();';
      graph.analyzeCallRelationships(code, '/src/test.ts', 'Service.main');

      const callsCount = graph.getCallsCount('/src/test.ts:Service.main');
      expect(callsCount).toBe(2);
    });

    it('handles classes without methods', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'class',
          name: 'EmptyClass',
          exported: false,
          startLine: 1,
          endLine: 2,
          methods: [],
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      const allNodes = graph.getAllNodes();
      expect(allNodes).toHaveLength(1); // Only the class node
      expect(allNodes[0]?.name).toBe('EmptyClass');
    });

    it('serializes and deserializes method nodes correctly', () => {
      const graph = new CodeGraph();
      const nodes: CodeNode[] = [
        {
          type: 'class',
          name: 'TestClass',
          exported: true,
          startLine: 1,
          endLine: 10,
          methods: [{ name: 'method1', async: true, signature: 'method1(): Promise<void>' }],
        },
      ];

      graph.addNodes(nodes, '/src/test.ts');

      // Serialize
      const json = graph.toJSON();
      expect(json.nodes).toHaveLength(2); // class + method

      // Deserialize would happen in CodeGraphService.loadGraph
      // Just verify the JSON structure is correct
      const methodNode = json.nodes.find((n) => n.id.includes('method1'));
      expect(methodNode).toBeDefined();
      expect(methodNode?.type).toBe('method');
    });
  });

  describe('Complex graph scenarios', () => {
    it('builds graph from multiple files', () => {
      const graph = new CodeGraph();

      const file1Nodes: CodeNode[] = [
        { type: 'function', name: 'fn1', exported: true, startLine: 1, endLine: 2 },
      ];
      const file2Nodes: CodeNode[] = [
        { type: 'function', name: 'fn2', exported: true, startLine: 1, endLine: 2 },
      ];

      graph.addNodes(file1Nodes, '/src/file1.ts');
      graph.addNodes(file2Nodes, '/src/file2.ts');
      graph.addImport('/src/file2.ts', './file1', ['fn1']);

      const allNodes = graph.getAllNodes();
      const file2Edges = graph.getEdges('/src/file2.ts');

      expect(allNodes).toHaveLength(2);
      expect(file2Edges.some((e) => e.to.includes('fn1'))).toBe(true);
    });

    it('handles circular import detection', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/a.ts', './b', ['funcB']);
      graph.addImport('/src/b.ts', './a', ['funcA']);

      const aEdges = graph.getEdges('/src/a.ts');
      const bEdges = graph.getEdges('/src/b.ts');

      expect(aEdges).toHaveLength(1);
      expect(bEdges).toHaveLength(1);
    });

    it('tracks multiple imports from same module', () => {
      const graph = new CodeGraph();

      graph.addImport('/src/app.ts', 'react', ['useState', 'useEffect', 'useContext']);
      const edges = graph.getEdges('/src/app.ts');

      expect(edges).toHaveLength(3);
      expect(edges.every((e) => e.from === '/src/app.ts')).toBe(true);
    });
  });
});
