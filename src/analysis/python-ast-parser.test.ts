import { describe, it, expect, vi } from 'vitest';
import { PythonASTParser } from './python-ast-parser.js';
import type { PythonBridge, ParsePythonResult } from '../crawl/bridge.js';

function createMockBridge(result: ParsePythonResult): PythonBridge {
  return {
    parsePython: vi.fn().mockResolvedValue(result),
  } as unknown as PythonBridge;
}

describe('PythonASTParser', () => {
  describe('parse', () => {
    it('parses Python code and returns CodeNodes', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'function',
            name: 'hello',
            exported: true,
            startLine: 1,
            endLine: 2,
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('def hello(): pass', 'test.py');

      expect(bridge.parsePython).toHaveBeenCalledWith('def hello(): pass', 'test.py');
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'hello',
        exported: true,
        startLine: 1,
        endLine: 2,
      });
    });

    it('handles async functions', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'function',
            name: 'fetch_data',
            exported: true,
            startLine: 1,
            endLine: 3,
            async: true,
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('async def fetch_data(): pass', 'async.py');

      expect(nodes[0]?.async).toBe(true);
      expect(nodes[0]?.name).toBe('fetch_data');
    });

    it('handles function signatures', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'function',
            name: 'greet',
            exported: true,
            startLine: 1,
            endLine: 2,
            signature: 'def greet(name: str) -> str',
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('def greet(name: str) -> str: pass', 'greet.py');

      expect(nodes[0]?.signature).toBe('def greet(name: str) -> str');
    });

    it('handles class methods', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'class',
            name: 'Calculator',
            exported: true,
            startLine: 1,
            endLine: 10,
            methods: [
              {
                name: 'add',
                async: false,
                signature: 'def add(self, a: int, b: int) -> int',
                startLine: 2,
                endLine: 3,
                calls: [],
              },
              {
                name: 'subtract',
                async: false,
                signature: 'def subtract(self, a: int, b: int) -> int',
                startLine: 4,
                endLine: 5,
                calls: [],
              },
            ],
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('class Calculator: pass', 'calc.py');

      expect(nodes[0]?.type).toBe('class');
      expect(nodes[0]?.methods).toHaveLength(2);
      expect(nodes[0]?.methods?.[0]?.name).toBe('add');
      expect(nodes[0]?.methods?.[1]?.name).toBe('subtract');
    });

    it('handles nodes without optional fields', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'function',
            name: 'simple',
            exported: false,
            startLine: 1,
            endLine: 1,
            // No async, signature, or methods
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('def simple(): pass', 'simple.py');

      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'simple',
        exported: false,
      });
      // Optional fields should not be present
      expect(nodes[0]?.async).toBeUndefined();
      expect(nodes[0]?.signature).toBeUndefined();
      expect(nodes[0]?.methods).toBeUndefined();
    });

    it('handles multiple nodes', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [
          {
            type: 'function',
            name: 'func1',
            exported: true,
            startLine: 1,
            endLine: 2,
          },
          {
            type: 'class',
            name: 'MyClass',
            exported: true,
            startLine: 3,
            endLine: 10,
          },
          {
            type: 'function',
            name: 'func2',
            exported: false,
            startLine: 11,
            endLine: 12,
          },
        ],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('# multiple definitions', 'multi.py');

      expect(nodes).toHaveLength(3);
      expect(nodes[0]?.name).toBe('func1');
      expect(nodes[1]?.name).toBe('MyClass');
      expect(nodes[2]?.name).toBe('func2');
    });

    it('returns empty array when no nodes found', async () => {
      const mockResult: ParsePythonResult = {
        nodes: [],
        imports: [],
      };

      const bridge = createMockBridge(mockResult);
      const parser = new PythonASTParser(bridge);
      const nodes = await parser.parse('# just a comment', 'empty.py');

      expect(nodes).toEqual([]);
    });
  });
});
