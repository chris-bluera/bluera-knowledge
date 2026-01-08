import { describe, it, expect } from 'vitest';
import { GoASTParser } from './go-ast-parser.js';

describe('GoASTParser', () => {
  const parser = new GoASTParser();

  describe('Function parsing', () => {
    it('parses basic function declaration', () => {
      const code = 'func hello() string { return "world" }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'hello',
        exported: false,
        async: false,
      });
    });

    it('parses exported function', () => {
      const code = 'func Hello() string { return "world" }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('Hello');
    });

    it('parses function with parameters', () => {
      const code = 'func add(a int, b int) int { return a + b }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('add');
      expect(nodes[0]?.type).toBe('function');
    });

    it('parses function with named return values', () => {
      const code = 'func divide(a, b int) (result int, err error) { return a / b, nil }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('divide');
    });

    it('parses variadic function', () => {
      const code = 'func sum(numbers ...int) int { return 0 }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('sum');
    });

    it('captures function line numbers', () => {
      const code = `// Comment
func test() {
    fmt.Println("hello")
    return
}`;
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.startLine).toBe(2);
      expect(nodes[0]?.endLine).toBeGreaterThan(2);
    });

    it('parses multiple functions', () => {
      const code = `
func first() int { return 1 }
func second() int { return 2 }
func Third() int { return 3 }
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const functions = nodes.filter((n) => n.type === 'function');
      expect(functions).toHaveLength(3);
      expect(functions.map((f) => f.name)).toEqual(['first', 'second', 'Third']);
      expect(functions[2]?.exported).toBe(true);
    });
  });

  describe('Struct parsing', () => {
    it('parses basic struct', () => {
      const code = 'type user struct { name string; age int }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'class',
        name: 'user',
        exported: false,
      });
    });

    it('parses exported struct', () => {
      const code = 'type User struct { Name string; Age int }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('User');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses empty struct', () => {
      const code = 'type Config struct {}';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('Config');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses struct with embedded fields', () => {
      const code = `type Server struct {
    http.Server
    port int
}`;
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('Server');
      expect(nodes[0]?.type).toBe('class');
    });

    it('captures struct line numbers', () => {
      const code = `
type Data struct {
    field1 string
    field2 int
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.startLine).toBe(1);
      expect(nodes[0]?.endLine).toBe(4);
    });
  });

  describe('Interface parsing', () => {
    it('parses basic interface', () => {
      const code = 'type drawable interface { Draw() }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'interface',
        name: 'drawable',
        exported: false,
      });
      expect(nodes[0]?.methods).toBeDefined();
    });

    it('parses exported interface', () => {
      const code = 'type Reader interface { Read(p []byte) (n int, err error) }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('Reader');
      expect(nodes[0]?.type).toBe('interface');
    });

    it('parses interface with multiple methods', () => {
      const code = `
type Animal interface {
    Speak() string
    Move()
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.methods).toHaveLength(2);
      expect(nodes[0]?.methods?.[0]?.name).toBe('Speak');
      expect(nodes[0]?.methods?.[1]?.name).toBe('Move');
    });

    it('parses empty interface', () => {
      const code = 'type Any interface {}';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('Any');
      expect(nodes[0]?.methods).toHaveLength(0);
    });

    it('parses interface with embedded interfaces', () => {
      const code = `type ReadWriter interface {
    Reader
    Writer
}`;
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('ReadWriter');
      expect(nodes[0]?.type).toBe('interface');
    });
  });

  describe('Type alias parsing', () => {
    it('parses type alias', () => {
      const code = 'type myInt int';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]).toMatchObject({
        type: 'type',
        name: 'myInt',
        exported: false,
      });
    });

    it('parses exported type alias', () => {
      const code = 'type UserID string';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('UserID');
    });

    it('parses complex type alias', () => {
      const code = 'type HandlerFunc func(http.ResponseWriter, *http.Request)';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('HandlerFunc');
      expect(nodes[0]?.signature).toContain('func');
    });
  });

  describe('Constant parsing', () => {
    it('parses const declaration', () => {
      const code = 'const maxSize = 100';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]).toMatchObject({
        type: 'const',
        name: 'maxSize',
        exported: false,
      });
    });

    it('parses exported const', () => {
      const code = 'const MaxSize = 100';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('MaxSize');
    });

    it('parses const with type', () => {
      const code = 'const Pi float64 = 3.14159';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('Pi');
      expect(nodes[0]?.signature).toContain('float64');
    });

    it('parses const block', () => {
      const code = `
const (
    Red = 0
    Green = 1
    Blue = 2
)
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const constants = nodes.filter((n) => n.type === 'const');
      expect(constants).toHaveLength(3);
      expect(constants.map((c) => c.name)).toEqual(['Red', 'Green', 'Blue']);
    });

    it('parses var declaration', () => {
      const code = 'var counter int = 0';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]).toMatchObject({
        type: 'const',
        name: 'counter',
      });
    });
  });

  describe('Method parsing', () => {
    it('parses method and attaches to struct', () => {
      const code = `
type User struct { name string }

func (u User) GetName() string {
    return u.name
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const userStruct = nodes.find((n) => n.name === 'User');
      expect(userStruct).toBeDefined();
      expect(userStruct?.methods).toHaveLength(1);
      expect(userStruct?.methods?.[0]?.name).toBe('GetName');
    });

    it('parses pointer receiver method', () => {
      const code = `
type Counter struct { count int }

func (c *Counter) Increment() {
    c.count++
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const counter = nodes.find((n) => n.name === 'Counter');
      expect(counter?.methods).toHaveLength(1);
      expect(counter?.methods?.[0]?.name).toBe('Increment');
    });

    it('parses multiple methods for same struct', () => {
      const code = `
type Stack struct { items []int }

func (s *Stack) Push(item int) {
    s.items = append(s.items, item)
}

func (s *Stack) Pop() int {
    item := s.items[len(s.items)-1]
    s.items = s.items[:len(s.items)-1]
    return item
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const stack = nodes.find((n) => n.name === 'Stack');
      expect(stack?.methods).toHaveLength(2);
      expect(stack?.methods?.map((m) => m.name)).toEqual(['Push', 'Pop']);
    });

    it('does not count methods as standalone functions', () => {
      const code = `
type Service struct {}

func (s Service) Process() {}
func standalone() {}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const functions = nodes.filter((n) => n.type === 'function');
      expect(functions).toHaveLength(1);
      expect(functions[0]?.name).toBe('standalone');
    });
  });

  describe('Import extraction', () => {
    it('extracts single import', () => {
      const code = 'import "fmt"';
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'fmt',
        specifiers: [],
        isType: false,
      });
    });

    it('extracts standard library import', () => {
      const code = 'import "net/http"';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('net/http');
    });

    it('extracts external package import', () => {
      const code = 'import "github.com/gorilla/mux"';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('github.com/gorilla/mux');
    });

    it('extracts import block', () => {
      const code = `
import (
    "fmt"
    "os"
    "net/http"
)
      `.trim();
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(3);
      expect(imports.map((i) => i.source)).toEqual(['fmt', 'os', 'net/http']);
    });

    it('extracts aliased import', () => {
      const code = 'import mux "github.com/gorilla/mux"';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('github.com/gorilla/mux');
    });

    it('extracts blank import', () => {
      const code = 'import _ "github.com/lib/pq"';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('github.com/lib/pq');
    });

    it('extracts multiple import blocks', () => {
      const code = `
import "fmt"

import (
    "os"
    "io"
)
      `.trim();
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(3);
    });
  });

  describe('Edge cases', () => {
    it('parses partial results for incomplete code (tree-sitter is fault-tolerant)', () => {
      const code = 'func incomplete(';
      const nodes = parser.parse(code, 'test.go');

      // tree-sitter is designed to be fault-tolerant for use in editors
      // It will return partial results even for syntactically incomplete code
      expect(nodes.length).toBeGreaterThan(0);
      expect(nodes[0]?.type).toBe('function');
      expect(nodes[0]?.name).toBe('incomplete');
    });

    it('handles empty file', () => {
      const code = '';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes).toEqual([]);
    });

    it('handles file with only comments', () => {
      const code = '// Just a comment\n/* Block comment */';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes).toEqual([]);
    });

    it('handles generic types', () => {
      const code = 'type List[T any] struct { items []T }';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.name).toBe('List');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses file with mixed constructs', () => {
      const code = `
package main

import "fmt"

const Version = "1.0"

type Config struct {
    host string
}

func (c Config) Print() {
    fmt.Println(c.host)
}

func main() {
    fmt.Println("Hello")
}

type Handler interface {
    Handle()
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      expect(nodes.length).toBeGreaterThan(0);

      const structs = nodes.filter((n) => n.type === 'class');
      const functions = nodes.filter((n) => n.type === 'function');
      const interfaces = nodes.filter((n) => n.type === 'interface');
      const constants = nodes.filter((n) => n.type === 'const');

      expect(structs).toHaveLength(1);
      expect(functions).toHaveLength(1); // Only main, not the method
      expect(interfaces).toHaveLength(1);
      expect(constants).toHaveLength(1);
    });
  });

  describe('Visibility detection', () => {
    it('detects exported names (uppercase)', () => {
      const code = 'func PublicFunc() {}';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('detects unexported names (lowercase)', () => {
      const code = 'func privateFunc() {}';
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(false);
    });

    it('handles single-letter names', () => {
      const code = `
func A() {}
func b() {}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[1]?.exported).toBe(false);
    });
  });

  describe('Method signatures', () => {
    it('captures method line numbers', () => {
      const code = `
type Test struct{}

func (t Test) method() {
    // line 5
    // line 6
}
      `.trim();
      const nodes = parser.parse(code, 'test.go');

      const test = nodes.find((n) => n.name === 'Test');
      const method = test?.methods?.[0];

      expect(method?.startLine).toBe(3);
      expect(method?.endLine).toBeGreaterThan(3);
    });
  });
});
