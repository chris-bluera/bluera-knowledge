import { describe, it, expect, vi } from 'vitest';
import { ParserFactory } from './parser-factory.js';
import type { PythonBridge, ParsePythonResult } from '../crawl/bridge.js';

describe('ParserFactory', () => {
  describe('parseFile', () => {
    it('parses .ts files with ASTParser typescript', async () => {
      const factory = new ParserFactory();
      const code = 'export function hello(): string { return "world"; }';
      const nodes = await factory.parseFile('test.ts', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'hello',
        exported: true,
      });
    });

    it('parses .tsx files with ASTParser typescript', async () => {
      const factory = new ParserFactory();
      const code = 'export function Button() { return <button>Click</button>; }';
      const nodes = await factory.parseFile('component.tsx', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.name).toBe('Button');
    });

    it('parses .js files with ASTParser javascript', async () => {
      const factory = new ParserFactory();
      const code = 'export function add(a, b) { return a + b; }';
      const nodes = await factory.parseFile('math.js', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'add',
        exported: true,
      });
    });

    it('parses .jsx files with ASTParser javascript', async () => {
      const factory = new ParserFactory();
      const code = 'export function Card() { return <div>Card</div>; }';
      const nodes = await factory.parseFile('card.jsx', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.name).toBe('Card');
    });

    it('parses .py files with PythonASTParser when bridge available', async () => {
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
      };

      const mockBridge = {
        parsePython: vi.fn().mockResolvedValue(mockResult),
      } as unknown as PythonBridge;

      const factory = new ParserFactory(mockBridge);
      const code = 'def greet(name: str) -> str:\n    return f"Hello {name}"';
      const nodes = await factory.parseFile('hello.py', code);

      expect(mockBridge.parsePython).toHaveBeenCalledWith(code, 'hello.py');
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'greet',
        exported: true,
      });
    });

    it('throws error for .py files when pythonBridge not available', async () => {
      const factory = new ParserFactory();
      const code = 'def hello(): pass';

      await expect(factory.parseFile('test.py', code)).rejects.toThrow(
        'Python bridge not available for parsing Python files'
      );
    });

    it('parses .rs files with RustASTParser', async () => {
      const factory = new ParserFactory();
      const code = 'pub fn calculate(x: i32) -> i32 { x * 2 }';
      const nodes = await factory.parseFile('lib.rs', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'calculate',
        exported: true,
      });
    });

    it('parses .go files with GoASTParser', async () => {
      const factory = new ParserFactory();
      const code = 'package main\n\nfunc Add(a, b int) int { return a + b }';
      const nodes = await factory.parseFile('main.go', code);

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'Add',
        exported: true,
      });
    });

    it('returns empty array for unsupported file extensions', async () => {
      const factory = new ParserFactory();
      const code = '/* some C code */ int main() { return 0; }';
      const nodes = await factory.parseFile('main.c', code);

      expect(nodes).toEqual([]);
    });

    it('returns empty array for unknown file extensions', async () => {
      const factory = new ParserFactory();
      const nodes = await factory.parseFile('data.yaml', 'key: value');

      expect(nodes).toEqual([]);
    });
  });
});
