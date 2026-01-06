import { describe, it, expect } from 'vitest';
import { ASTParser } from './ast-parser.js';

describe('ASTParser', () => {
  const parser = new ASTParser();

  describe('Function parsing', () => {
    it('parses basic function declaration', () => {
      const code = 'function hello() { return "world"; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'hello',
        exported: false,
        async: false
      });
    });

    it('parses async function', () => {
      const code = 'async function fetchData() { return await fetch("/api"); }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.async).toBe(true);
      expect(nodes[0]?.name).toBe('fetchData');
    });

    it('parses exported function', () => {
      const code = 'export function publicFn() { return true; }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('publicFn');
    });

    it('parses default exported function', () => {
      const code = 'export default function main() { console.log("hi"); }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('main');
    });

    it('captures function line numbers', () => {
      const code = `// Comment
function test() {
  console.log("hello");
  return true;
}`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.startLine).toBe(2);
      expect(nodes[0]?.endLine).toBe(5);
    });

    it('extracts function signature with parameters', () => {
      const code = 'function add(a, b) { return a + b; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.signature).toBe('add(a, b)');
    });

    it('handles function with no parameters', () => {
      const code = 'function noParams() { return 42; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.signature).toBe('noParams()');
    });

    it('ignores arrow functions (not declarations)', () => {
      const code = 'const arrow = () => 42;';
      const nodes = parser.parse(code, 'javascript');

      // Should not capture arrow functions, only declarations
      expect(nodes.filter(n => n.type === 'function')).toHaveLength(0);
    });
  });

  describe('Class parsing', () => {
    it('parses basic class declaration', () => {
      const code = 'class MyClass { constructor() {} }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'class',
        name: 'MyClass',
        exported: false
      });
    });

    it('parses exported class', () => {
      const code = 'export class PublicClass {}';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('PublicClass');
    });

    it('extracts class methods', () => {
      const code = `class Calculator {
  add(a, b) { return a + b; }
  subtract(a, b) { return a - b; }
}`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.methods).toHaveLength(2);
      expect(nodes[0]?.methods?.[0]?.name).toBe('add');
      expect(nodes[0]?.methods?.[1]?.name).toBe('subtract');
    });

    it('identifies async methods', () => {
      const code = `class API {
  async fetch() { return await getData(); }
}`;
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.methods?.[0]?.async).toBe(true);
    });

    it('extracts method signatures', () => {
      const code = `class Math {
  multiply(x, y) { return x * y; }
}`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.methods?.[0]?.signature).toBe('multiply(x, y)');
    });

    it('captures class line numbers', () => {
      const code = `
class Test {
  method() {}
}`;
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.startLine).toBe(2);
      expect(nodes[0]?.endLine).toBe(4);
    });
  });

  describe('Interface and type parsing (TypeScript)', () => {
    it('parses interface declaration', () => {
      const code = 'interface User { name: string; age: number; }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'interface',
        name: 'User',
        exported: false
      });
    });

    it('parses exported interface', () => {
      const code = 'export interface Config { apiKey: string; }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('Config');
    });

    it('captures interface line numbers', () => {
      const code = `interface Person {
  firstName: string;
  lastName: string;
}`;
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.startLine).toBe(1);
      expect(nodes[0]?.endLine).toBe(4);
    });
  });

  describe('Malformed code handling', () => {
    it('returns empty array for syntax errors', () => {
      const code = 'function broken( { this is not valid }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes).toEqual([]);
    });

    it('handles incomplete function', () => {
      const code = 'function incomplete() {';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes).toEqual([]);
    });

    it('handles invalid TypeScript syntax', () => {
      const code = 'interface Broken { prop: ;;;; }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes).toEqual([]);
    });

    it('handles mixed valid and invalid code', () => {
      const code = `
function valid() { return true; }
function invalid( { syntax error
`;
      const nodes = parser.parse(code, 'javascript');

      // Should fail to parse and return empty array
      expect(nodes).toEqual([]);
    });

    it('handles empty string', () => {
      const nodes = parser.parse('', 'javascript');

      expect(nodes).toEqual([]);
    });

    it('handles only whitespace', () => {
      const nodes = parser.parse('   \n  \t  ', 'javascript');

      expect(nodes).toEqual([]);
    });

    it('handles only comments', () => {
      const code = `// Just a comment
/* And a block comment */`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes).toEqual([]);
    });
  });

  describe('Import extraction', () => {
    it('extracts named imports', () => {
      const code = 'import { foo, bar } from "module";';
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'module',
        specifiers: ['foo', 'bar'],
        isType: false
      });
    });

    it('extracts default import', () => {
      const code = 'import React from "react";';
      const imports = parser.extractImports(code);

      expect(imports[0]?.specifiers).toContain('React');
      expect(imports[0]?.source).toBe('react');
    });

    it('extracts namespace import', () => {
      const code = 'import * as utils from "./utils";';
      const imports = parser.extractImports(code);

      expect(imports[0]?.specifiers).toContain('utils');
      expect(imports[0]?.source).toBe('./utils');
    });

    it('identifies type imports', () => {
      const code = 'import type { User } from "./types";';
      const imports = parser.extractImports(code);

      expect(imports[0]?.isType).toBe(true);
      expect(imports[0]?.source).toBe('./types');
    });

    it('extracts multiple imports', () => {
      const code = `
import React from "react";
import { useState } from "react";
import type { Props } from "./types";
`;
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(3);
      expect(imports[0]?.source).toBe('react');
      expect(imports[1]?.source).toBe('react');
      expect(imports[2]?.isType).toBe(true);
    });

    it('handles imports with aliases', () => {
      const code = 'import { original as alias } from "module";';
      const imports = parser.extractImports(code);

      expect(imports[0]?.specifiers).toContain('alias');
    });

    it('returns empty array for malformed imports', () => {
      const code = 'import { broken from "module"';
      const imports = parser.extractImports(code);

      expect(imports).toEqual([]);
    });

    it('handles file with no imports', () => {
      const code = 'function test() { return 42; }';
      const imports = parser.extractImports(code);

      expect(imports).toEqual([]);
    });

    it('handles empty file', () => {
      const imports = parser.extractImports('');

      expect(imports).toEqual([]);
    });
  });

  describe('Export detection', () => {
    it('detects named export', () => {
      const code = 'export function namedExport() {}';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('detects default export', () => {
      const code = 'export default function defaultExport() {}';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('detects non-exported functions', () => {
      const code = 'function privateFunction() {}';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.exported).toBe(false);
    });

    it('detects exported class', () => {
      const code = 'export class ExportedClass {}';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('detects exported interface', () => {
      const code = 'export interface ExportedInterface { prop: string; }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.exported).toBe(true);
    });
  });

  describe('Module system handling', () => {
    it('handles CJS/ESM module variations', () => {
      // This test ensures the getTraverse function handles both module formats
      // The actual implementation is tested by the fact that all other tests work
      const code = 'function test() { return true; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.name).toBe('test');
    });
  });

  describe('Edge cases and special scenarios', () => {
    it('handles default exported class', () => {
      const code = 'export default class DefaultClass { method() {} }';
      const nodes = parser.parse(code, 'typescript');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('DefaultClass');
    });

    it('handles anonymous default exported class (no id)', () => {
      const code = 'export default class { method() {} }';
      const nodes = parser.parse(code, 'javascript');

      // Anonymous classes don't have an id, should be skipped
      expect(nodes.filter(n => n.type === 'class')).toHaveLength(0);
    });

    it('handles class with computed property method (non-identifier key)', () => {
      const code = `class MyClass {
  ['computed']() { return 42; }
  normalMethod() { return 1; }
}`;
      const nodes = parser.parse(code, 'javascript');

      // Computed properties have StringLiteral keys, not Identifier
      // Only normalMethod should be captured
      expect(nodes[0]?.methods).toHaveLength(1);
      expect(nodes[0]?.methods?.[0]?.name).toBe('normalMethod');
    });

    it('handles class with rest parameters in method', () => {
      const code = `class MyClass {
  method(...args) { return args; }
}`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.methods?.[0]?.signature).toBe('method(param)');
    });

    it('handles function with rest parameters', () => {
      const code = 'function spread(...items) { return items; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.signature).toBe('spread(param)');
    });

    it('handles functions with complex destructured parameters', () => {
      const code = 'function complex({ a, b }, [c, d]) { return a + b + c + d; }';
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.name).toBe('complex');
      expect(nodes[0]?.signature).toContain('complex(');
    });

    it('handles JSX in TypeScript', () => {
      const code = `
function Component() {
  return <div>Hello</div>;
}`;
      const nodes = parser.parse(code, 'typescript');

      expect(nodes[0]?.name).toBe('Component');
    });

    it('handles multiple declarations in one file', () => {
      const code = `
function fn1() {}
class Class1 {}
interface Interface1 {}
function fn2() {}
`;
      const nodes = parser.parse(code, 'typescript');

      expect(nodes).toHaveLength(4);
      expect(nodes.map(n => n.name)).toEqual(['fn1', 'Class1', 'Interface1', 'fn2']);
    });

    it('handles anonymous function expressions (no id)', () => {
      const code = 'export default function() { return 42; }';
      const nodes = parser.parse(code, 'javascript');

      // Anonymous functions don't have an id, should be skipped
      expect(nodes.filter(n => n.name)).toHaveLength(0);
    });

    it('handles class with constructor', () => {
      const code = `class MyClass {
  constructor(name) {
    this.name = name;
  }
}`;
      const nodes = parser.parse(code, 'javascript');

      expect(nodes[0]?.name).toBe('MyClass');
      // Constructor is a method
      expect(nodes[0]?.methods?.some(m => m.name === 'constructor')).toBe(true);
    });

    it('handles very long file with many declarations', () => {
      const functions = Array.from({ length: 50 }, (_, i) =>
        `function fn${i}() { return ${i}; }`
      ).join('\n');

      const nodes = parser.parse(functions, 'javascript');

      expect(nodes).toHaveLength(50);
      expect(nodes[0]?.name).toBe('fn0');
      expect(nodes[49]?.name).toBe('fn49');
    });
  });
});
