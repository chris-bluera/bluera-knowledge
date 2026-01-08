import { describe, it, expect } from 'vitest';
import { ChunkingService } from './chunking.service.js';

describe('ChunkingService', () => {
  const chunker = new ChunkingService({ chunkSize: 100, chunkOverlap: 20 });

  describe('Basic sliding window chunking', () => {
    it('splits text into chunks', () => {
      const text = 'A'.repeat(250);
      const chunks = chunker.chunk(text);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => c.content.length <= 100)).toBe(true);
    });

    it('preserves overlap between chunks', () => {
      const text = 'word '.repeat(50); // 250 chars
      const chunks = chunker.chunk(text);
      if (chunks.length >= 2) {
        const end1 = chunks[0]!.content.slice(-20);
        const start2 = chunks[1]!.content.slice(0, 20);
        expect(end1).toBe(start2);
      }
    });

    it('returns single chunk for small text', () => {
      const text = 'small text';
      const chunks = chunker.chunk(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe(text);
    });

    it('assigns chunk indices correctly', () => {
      const text = 'A'.repeat(300);
      const chunks = chunker.chunk(text);
      expect(chunks[0]!.chunkIndex).toBe(0);
      expect(chunks[1]!.chunkIndex).toBe(1);
      expect(chunks.every((c) => c.totalChunks === chunks.length)).toBe(true);
    });

    it('handles empty text', () => {
      const chunks = chunker.chunk('');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.content).toBe('');
    });

    it('sets correct offsets for chunks', () => {
      const text = 'A'.repeat(250);
      const chunks = chunker.chunk(text);
      expect(chunks[0]!.startOffset).toBe(0);
      expect(chunks[0]!.endOffset).toBe(100);
      expect(chunks[1]!.startOffset).toBe(80); // chunkSize - overlap
      expect(chunks[1]!.endOffset).toBe(180);
    });
  });

  describe('Markdown semantic chunking', () => {
    it('chunks markdown by sections', () => {
      const markdown = `# Header 1
Content for section 1

## Header 2
Content for section 2

### Header 3
Content for section 3`;

      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.sectionHeader === 'Header 1')).toBe(true);
      expect(chunks.some((c) => c.sectionHeader === 'Header 2')).toBe(true);
      expect(chunks.some((c) => c.sectionHeader === 'Header 3')).toBe(true);
    });

    it('handles markdown with no headers', () => {
      const markdown = 'Just plain text without headers';
      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.sectionHeader).toBeUndefined();
    });

    it('handles markdown with only one header', () => {
      const markdown = '# Only Header\nSome content';
      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('splits large markdown sections with sliding window', () => {
      const largeContent = 'A'.repeat(150);
      const markdown = `# Header 1\n${largeContent}\n\n## Header 2\nSmall content`;

      const chunks = chunker.chunk(markdown, 'test.md');
      // Large section should be split
      expect(chunks.length).toBeGreaterThan(2);
      expect(chunks.filter((c) => c.sectionHeader === 'Header 1').length).toBeGreaterThan(1);
    });

    it('preserves markdown section headers in metadata', () => {
      const markdown = `#### Level 4 Header
Content here`;

      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks[0]!.sectionHeader).toBe('Level 4 Header');
    });

    it('handles consecutive headers', () => {
      const markdown = `# Header 1
## Header 2
### Header 3
Content`;

      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('handles markdown with mixed header levels', () => {
      const markdown = `# H1
Content 1
### H3
Content 3
## H2
Content 2`;

      const chunks = chunker.chunk(markdown, 'test.md');
      expect(chunks.some((c) => c.sectionHeader === 'H1')).toBe(true);
      expect(chunks.some((c) => c.sectionHeader === 'H3')).toBe(true);
      expect(chunks.some((c) => c.sectionHeader === 'H2')).toBe(true);
    });
  });

  describe('Code semantic chunking', () => {
    it('chunks code by function declarations', () => {
      const code = `function foo() {
  return 'foo';
}

function bar() {
  return 'bar';
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.functionName === 'foo')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'bar')).toBe(true);
    });

    it('handles class declarations', () => {
      const code = `class MyClass {
  constructor() {}
}

class AnotherClass {
  method() {}
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'MyClass')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'AnotherClass')).toBe(true);
    });

    it('handles exported declarations', () => {
      const code = `export function exportedFn() {
  return 1;
}

export class ExportedClass {}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'exportedFn')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'ExportedClass')).toBe(true);
    });

    it('handles async functions', () => {
      const code = `async function asyncFn() {
  return await Promise.resolve(1);
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'asyncFn')).toBe(true);
    });

    it('handles const/let/var declarations', () => {
      const code = `const myConst = 42;

let myLet = 'test';

var myVar = true;`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'myConst')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'myLet')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'myVar')).toBe(true);
    });

    it('handles interface and type declarations', () => {
      const code = `interface MyInterface {
  prop: string;
}

type MyType = {
  value: number;
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'MyInterface')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'MyType')).toBe(true);
    });

    it('handles enum declarations', () => {
      const code = `enum Color {
  Red,
  Green,
  Blue
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'Color')).toBe(true);
    });

    it('handles code with no declarations', () => {
      const code = 'console.log("hello");';
      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks).toHaveLength(1);
    });

    it('handles code with only one declaration', () => {
      const code = 'function single() { return 1; }';
      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks).toHaveLength(1);
    });

    it('splits large function declarations with sliding window', () => {
      const largeBody = 'console.log("test");\\n'.repeat(20);
      const code = `function largeFn() {
${largeBody}
}

function smallFn() {
  return 1;
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.length).toBeGreaterThan(2);
    });

    it('handles nested braces in code', () => {
      const code = `function withNested() {
  if (true) {
    while (x) {
      return { a: 1 };
    }
  }
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'withNested')).toBe(true);
    });

    it('exposes brace counting bug - braces in strings', () => {
      // This test should FAIL with the current implementation
      // because it doesn't handle braces inside strings
      const code = `function withString() {
  const obj = "{}";
  const template = \`{ value: \${x} }\`;
  return true;
}

function nextFn() {
  return 2;
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'withString')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'nextFn')).toBe(true);
      // The bug: braces in strings should be ignored for boundary detection
    });

    it('exposes brace counting bug - braces in comments', () => {
      // This test should FAIL with the current implementation
      // because it doesn't handle braces in comments
      const code = `function withComments() {
  // This is a comment with { and }
  /* Multi-line comment
   * with { braces } inside
   */
  return true;
}

function nextFn() {
  return 2;
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'withComments')).toBe(true);
      expect(chunks.some((c) => c.functionName === 'nextFn')).toBe(true);
      // The bug: braces in comments should be ignored for boundary detection
    });

    it('handles JSDoc comments before declarations', () => {
      const code = `/**
 * Documentation for myFn
 * @returns A number
 */
function myFn() {
  return 42;
}`;

      const chunks = chunker.chunk(code, 'test.ts');
      expect(chunks.some((c) => c.functionName === 'myFn')).toBe(true);
      expect(chunks[0]!.content).toContain('Documentation');
    });
  });

  describe('File type detection', () => {
    it('uses markdown chunking for .md files', () => {
      const text = '# Header\nContent';
      const chunks = chunker.chunk(text, 'readme.md');
      expect(chunks[0]!.sectionHeader).toBe('Header');
    });

    it('uses markdown chunking for .MD files (case insensitive)', () => {
      const text = '# Header\nContent';
      const chunks = chunker.chunk(text, 'README.MD');
      expect(chunks[0]!.sectionHeader).toBe('Header');
    });

    it('uses code chunking for .ts files', () => {
      const code = 'function test() {}\nfunction test2() {}';
      const chunks = chunker.chunk(code, 'file.ts');
      expect(chunks.some((c) => c.functionName === 'test')).toBe(true);
    });

    it('uses code chunking for .tsx files', () => {
      const code = 'function Component() {}\nfunction Other() {}';
      const chunks = chunker.chunk(code, 'component.tsx');
      expect(chunks.some((c) => c.functionName === 'Component')).toBe(true);
    });

    it('uses code chunking for .js files', () => {
      const code = 'function test() {}\nfunction test2() {}';
      const chunks = chunker.chunk(code, 'file.js');
      expect(chunks.some((c) => c.functionName === 'test')).toBe(true);
    });

    it('uses code chunking for .jsx files', () => {
      const code = 'function Component() {}\nfunction Other() {}';
      const chunks = chunker.chunk(code, 'component.jsx');
      expect(chunks.some((c) => c.functionName === 'Component')).toBe(true);
    });

    it('uses sliding window for unknown file types', () => {
      const text = '# Not Markdown\nfunction notCode() {}';
      const chunks = chunker.chunk(text, 'file.txt');
      expect(chunks[0]!.sectionHeader).toBeUndefined();
      expect(chunks[0]!.functionName).toBeUndefined();
    });

    it('uses sliding window when no file path provided', () => {
      const text = 'Some text';
      const chunks = chunker.chunk(text);
      expect(chunks).toHaveLength(1);
    });
  });
});
