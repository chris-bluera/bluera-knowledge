import { describe, it, expect } from 'vitest';
import {
  createRustParser,
  createGoParser,
  parseRustCode,
  parseGoCode,
  positionToLineNumber,
  getNodeText,
  getChildrenOfType,
  getFirstChildOfType,
  getChildByFieldName,
  hasVisibilityModifier,
  getVisibilityModifier,
  isAsyncFunction,
  isUnsafeFunction,
  getFunctionSignature,
  queryNodesByType,
  extractImportPath,
  type TreeSitterNode,
  type TreeSitterTree,
} from './tree-sitter-parser.js';

describe('tree-sitter-parser', () => {
  describe('createRustParser', () => {
    it('creates a functional Rust parser', () => {
      const parser = createRustParser();
      expect(parser).toBeDefined();
      const tree = parser.parse('fn main() {}');
      expect(tree).toBeDefined();
    });
  });

  describe('createGoParser', () => {
    it('creates a functional Go parser', () => {
      const parser = createGoParser();
      expect(parser).toBeDefined();
      const tree = parser.parse('package main\nfunc main() {}');
      expect(tree).toBeDefined();
    });
  });

  describe('parseRustCode', () => {
    it('parses valid Rust code', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      expect(tree?.rootNode).toBeDefined();
    });

    it('handles malformed Rust code gracefully', () => {
      // Tree-sitter is very tolerant, but we test the structure
      const tree = parseRustCode('fn {{{ invalid syntax');
      // Tree-sitter returns a tree even with errors, so check it's valid
      expect(tree).not.toBeNull();
    });
  });

  describe('parseGoCode', () => {
    it('parses valid Go code', () => {
      const tree = parseGoCode('package main\nfunc hello() {}');
      expect(tree).not.toBeNull();
      expect(tree?.rootNode).toBeDefined();
    });

    it('handles malformed Go code gracefully', () => {
      // Tree-sitter is very tolerant
      const tree = parseGoCode('package {{{ invalid');
      expect(tree).not.toBeNull();
    });
  });

  describe('positionToLineNumber', () => {
    it('converts 0-indexed row to 1-indexed line number', () => {
      expect(positionToLineNumber({ row: 0, column: 0 })).toBe(1);
      expect(positionToLineNumber({ row: 5, column: 10 })).toBe(6);
      expect(positionToLineNumber({ row: 99, column: 0 })).toBe(100);
    });
  });

  describe('getNodeText', () => {
    it('returns the text content of a node', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const rootText = getNodeText(tree!.rootNode as TreeSitterNode);
      expect(rootText).toBe('fn hello() {}');
    });
  });

  describe('getChildrenOfType', () => {
    it('returns children matching the specified type', () => {
      const tree = parseRustCode('fn a() {} fn b() {} fn c() {}');
      expect(tree).not.toBeNull();
      const functions = getChildrenOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(functions).toHaveLength(3);
    });

    it('returns empty array when no children match', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const structs = getChildrenOfType(tree!.rootNode as TreeSitterNode, 'struct_item');
      expect(structs).toEqual([]);
    });
  });

  describe('getFirstChildOfType', () => {
    it('returns first child matching the type', () => {
      const tree = parseRustCode('fn first() {} fn second() {}');
      expect(tree).not.toBeNull();
      const firstFn = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(firstFn).not.toBeNull();
      expect(firstFn!.text).toContain('first');
    });

    it('returns null when no child matches', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const structNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'struct_item');
      expect(structNode).toBeNull();
    });
  });

  describe('getChildByFieldName', () => {
    it('returns child by field name', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      const nameNode = getChildByFieldName(fnNode!, 'name');
      expect(nameNode).not.toBeNull();
      expect(nameNode!.text).toBe('hello');
    });

    it('returns null when field does not exist', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      const nonexistent = getChildByFieldName(fnNode!, 'nonexistent_field');
      expect(nonexistent).toBeNull();
    });
  });

  describe('hasVisibilityModifier', () => {
    it('returns true for pub functions', () => {
      const tree = parseRustCode('pub fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(hasVisibilityModifier(fnNode!)).toBe(true);
    });

    it('returns false for private functions', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(hasVisibilityModifier(fnNode!)).toBe(false);
    });
  });

  describe('getVisibilityModifier', () => {
    it('returns visibility text for pub items', () => {
      const tree = parseRustCode('pub fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(getVisibilityModifier(fnNode!)).toBe('pub');
    });

    it('returns visibility text for pub(crate)', () => {
      const tree = parseRustCode('pub(crate) fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(getVisibilityModifier(fnNode!)).toBe('pub(crate)');
    });

    it('returns null for private items', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(getVisibilityModifier(fnNode!)).toBeNull();
    });
  });

  describe('isAsyncFunction', () => {
    it('returns true for async functions', () => {
      const tree = parseRustCode('async fn fetch() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(isAsyncFunction(fnNode!)).toBe(true);
    });

    it('returns false for sync functions', () => {
      const tree = parseRustCode('fn sync() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(isAsyncFunction(fnNode!)).toBe(false);
    });
  });

  describe('isUnsafeFunction', () => {
    it('returns true for unsafe functions', () => {
      const tree = parseRustCode('unsafe fn danger() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(isUnsafeFunction(fnNode!)).toBe(true);
    });

    it('returns false for safe functions', () => {
      const tree = parseRustCode('fn safe() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      expect(isUnsafeFunction(fnNode!)).toBe(false);
    });
  });

  describe('getFunctionSignature', () => {
    it('returns basic function signature', () => {
      const tree = parseRustCode('fn hello() {}');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      const sig = getFunctionSignature(fnNode!);
      expect(sig).toContain('hello');
      expect(sig).toContain('()');
    });

    it('returns signature with return type', () => {
      const tree = parseRustCode('fn get() -> i32 { 42 }');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      const sig = getFunctionSignature(fnNode!);
      expect(sig).toContain('get');
      expect(sig).toContain('i32');
    });

    it('returns signature with type parameters', () => {
      const tree = parseRustCode('fn generic<T>(val: T) -> T { val }');
      expect(tree).not.toBeNull();
      const fnNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'function_item');
      expect(fnNode).not.toBeNull();
      const sig = getFunctionSignature(fnNode!);
      expect(sig).toContain('<T>');
    });

    it('returns empty string when name node is missing', () => {
      // Create a mock node without a name field
      const mockNode: Partial<TreeSitterNode> = {
        children: [],
        childForFieldName: () => null,
      };
      const sig = getFunctionSignature(mockNode as TreeSitterNode);
      expect(sig).toBe('');
    });
  });

  describe('queryNodesByType', () => {
    it('queries single node type', () => {
      const tree = parseRustCode('fn a() {} struct B {} fn c() {}');
      expect(tree).not.toBeNull();
      const functions = queryNodesByType(tree as TreeSitterTree, 'function_item');
      expect(functions).toHaveLength(2);
    });

    it('queries multiple node types', () => {
      const tree = parseRustCode('fn a() {} struct B {} fn c() {}');
      expect(tree).not.toBeNull();
      const items = queryNodesByType(tree as TreeSitterTree, ['function_item', 'struct_item']);
      expect(items).toHaveLength(3);
    });
  });

  describe('extractImportPath', () => {
    it('extracts import path from use statement', () => {
      const tree = parseRustCode('use std::collections::HashMap;');
      expect(tree).not.toBeNull();
      const useNode = getFirstChildOfType(tree!.rootNode as TreeSitterNode, 'use_declaration');
      expect(useNode).not.toBeNull();
      const path = extractImportPath(useNode!);
      expect(path).toContain('std');
    });

    it('returns empty string when argument node is missing', () => {
      // Create a mock node without an argument field
      const mockNode: Partial<TreeSitterNode> = {
        childForFieldName: () => null,
      };
      const path = extractImportPath(mockNode as TreeSitterNode);
      expect(path).toBe('');
    });
  });
});
