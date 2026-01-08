import { describe, it, expect } from 'vitest';
import { RustASTParser } from './rust-ast-parser.js';

describe('RustASTParser', () => {
  const parser = new RustASTParser();

  describe('Function parsing', () => {
    it('parses basic function declaration', () => {
      const code = 'fn hello() -> &str { "world" }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'hello',
        exported: false,
        async: false,
      });
      expect(nodes[0]?.signature).toContain('hello');
    });

    it('parses async function', () => {
      const code = 'async fn fetch_data() -> Result<Data, Error> { Ok(Data) }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.async).toBe(true);
      expect(nodes[0]?.name).toBe('fetch_data');
      expect(nodes[0]?.type).toBe('function');
    });

    it('parses public function', () => {
      const code = 'pub fn api_call() -> bool { true }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('api_call');
    });

    it('parses generic function', () => {
      const code = 'fn generic<T>(value: T) -> T { value }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('generic');
      expect(nodes[0]?.signature).toContain('<T>');
      expect(nodes[0]?.signature).toContain('value: T');
    });

    it('parses function with lifetime parameters', () => {
      const code = "fn longest<'a>(x: &'a str, y: &'a str) -> &'a str { x }";
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('longest');
      expect(nodes[0]?.signature).toContain("'a");
    });

    it('parses unsafe function', () => {
      const code = 'unsafe fn dangerous() { /* unsafe code */ }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('dangerous');
      expect(nodes[0]?.type).toBe('function');
    });

    it('captures function line numbers', () => {
      const code = `// Comment
fn test() {
    println!("hello");
    true
}`;
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.startLine).toBe(2);
      expect(nodes[0]?.endLine).toBeGreaterThan(2);
    });

    it('parses multiple functions', () => {
      const code = `
fn first() -> i32 { 1 }
fn second() -> i32 { 2 }
pub fn third() -> i32 { 3 }
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const functions = nodes.filter((n) => n.type === 'function');
      expect(functions).toHaveLength(3);
      expect(functions.map((f) => f.name)).toEqual(['first', 'second', 'third']);
      expect(functions[2]?.exported).toBe(true);
    });
  });

  describe('Struct parsing', () => {
    it('parses basic struct', () => {
      const code = 'struct User { name: String, age: u32 }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'class',
        name: 'User',
        exported: false,
      });
    });

    it('parses public struct', () => {
      const code = 'pub struct Config { key: String }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('Config');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses generic struct', () => {
      const code = 'struct Container<T> { value: T }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('Container');
      expect(nodes[0]?.signature).toContain('<T>');
    });

    it('parses tuple struct', () => {
      const code = 'struct Point(i32, i32);';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('Point');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses struct with multiple generic parameters', () => {
      const code = 'struct HashMap<K, V> { data: Vec<(K, V)> }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('HashMap');
      expect(nodes[0]?.signature).toContain('<K, V>');
    });

    it('captures struct line numbers', () => {
      const code = `
struct Data {
    field1: String,
    field2: i32,
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.startLine).toBe(1);
      expect(nodes[0]?.endLine).toBe(4);
    });
  });

  describe('Trait parsing', () => {
    it('parses basic trait', () => {
      const code = 'trait Drawable { fn draw(&self); }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'interface',
        name: 'Drawable',
        exported: false,
      });
      expect(nodes[0]?.methods).toBeDefined();
    });

    it('parses public trait', () => {
      const code = 'pub trait Service { async fn process(&self); }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('Service');
      expect(nodes[0]?.type).toBe('interface');
    });

    it('parses trait with multiple methods', () => {
      const code = `
trait Animal {
    fn make_sound(&self);
    fn get_name(&self) -> String;
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.methods).toHaveLength(2);
      expect(nodes[0]?.methods?.[0]?.name).toBe('make_sound');
      expect(nodes[0]?.methods?.[1]?.name).toBe('get_name');
    });

    it('parses trait with async methods', () => {
      const code = 'trait AsyncTask { async fn execute(&self) -> Result<(), Error>; }';
      const nodes = parser.parse(code, 'test.rs');

      const trait = nodes[0];
      expect(trait?.methods).toHaveLength(1);
      expect(trait?.methods?.[0]?.async).toBe(true);
    });

    it('parses generic trait', () => {
      const code = 'trait Iterator<T> { fn next(&mut self) -> Option<T>; }';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.signature).toContain('<T>');
    });
  });

  describe('Type alias parsing', () => {
    it('parses type alias', () => {
      const code = 'type Result<T> = std::result::Result<T, Error>;';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]).toMatchObject({
        type: 'type',
        name: 'Result',
        exported: false,
      });
      expect(nodes[0]?.signature).toContain('Result');
    });

    it('parses public type alias', () => {
      const code = 'pub type UserId = String;';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('UserId');
    });

    it('parses complex type alias', () => {
      const code = 'type ComplexMap = HashMap<String, Vec<Option<i32>>>;';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('ComplexMap');
      expect(nodes[0]?.signature).toContain('HashMap');
    });
  });

  describe('Constant parsing', () => {
    it('parses const item', () => {
      const code = 'const MAX_SIZE: usize = 100;';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]).toMatchObject({
        type: 'const',
        name: 'MAX_SIZE',
        exported: false,
      });
      expect(nodes[0]?.signature).toContain('usize');
    });

    it('parses public const', () => {
      const code = 'pub const API_VERSION: &str = "v1";';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.name).toBe('API_VERSION');
    });

    it('parses static item', () => {
      const code = 'static COUNTER: AtomicUsize = AtomicUsize::new(0);';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]).toMatchObject({
        type: 'const',
        name: 'COUNTER',
      });
    });

    it('parses public static', () => {
      const code = 'pub static CONFIG: Config = Config::default();';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
      expect(nodes[0]?.type).toBe('const');
    });
  });

  describe('Impl block parsing', () => {
    it('parses impl block and attaches methods to struct', () => {
      const code = `
struct User { name: String }

impl User {
    fn new(name: String) -> Self {
        User { name }
    }

    fn get_name(&self) -> &str {
        &self.name
    }
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const userStruct = nodes.find((n) => n.name === 'User');
      expect(userStruct).toBeDefined();
      expect(userStruct?.methods).toHaveLength(2);
      expect(userStruct?.methods?.[0]?.name).toBe('new');
      expect(userStruct?.methods?.[1]?.name).toBe('get_name');
    });

    it('parses impl block with async methods', () => {
      const code = `
struct Service;

impl Service {
    async fn fetch(&self) -> Result<Data, Error> {
        Ok(Data)
    }
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const service = nodes.find((n) => n.name === 'Service');
      expect(service?.methods?.[0]?.async).toBe(true);
    });

    it('parses trait impl block', () => {
      const code = `
struct Circle;
trait Drawable { fn draw(&self); }

impl Drawable for Circle {
    fn draw(&self) {
        println!("Drawing circle");
    }
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      // Trait impl methods shouldn't attach to struct
      const circle = nodes.find((n) => n.name === 'Circle');
      expect(circle).toBeDefined();
    });

    it('parses multiple impl blocks for same struct', () => {
      const code = `
struct Data;

impl Data {
    fn method1(&self) {}
}

impl Data {
    fn method2(&self) {}
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const data = nodes.find((n) => n.name === 'Data');
      expect(data?.methods).toHaveLength(2);
    });
  });

  describe('Import extraction', () => {
    it('extracts standard library import', () => {
      const code = 'use std::collections::HashMap;';
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'std::collections',
        specifiers: ['HashMap'],
        isType: false,
      });
    });

    it('extracts external crate import', () => {
      const code = 'use serde::Serialize;';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('serde');
      expect(imports[0]?.specifiers).toContain('Serialize');
    });

    it('extracts crate-relative import', () => {
      const code = 'use crate::utils::helper;';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('crate::utils');
      expect(imports[0]?.specifiers).toContain('helper');
    });

    it('extracts super import', () => {
      const code = 'use super::Type;';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('super');
      expect(imports[0]?.specifiers).toContain('Type');
    });

    it('extracts glob import', () => {
      const code = 'use std::io::*;';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('std::io');
      expect(imports[0]?.specifiers).toContain('*');
    });

    it('extracts scoped imports', () => {
      const code = 'use std::io::{Read, Write};';
      const imports = parser.extractImports(code);

      expect(imports[0]?.source).toBe('std::io');
      expect(imports[0]?.specifiers).toContain('Read');
      expect(imports[0]?.specifiers).toContain('Write');
    });

    it('extracts multiple imports', () => {
      const code = `
use std::collections::HashMap;
use serde::Serialize;
use crate::models::User;
      `.trim();
      const imports = parser.extractImports(code);

      expect(imports).toHaveLength(3);
      expect(imports[0]?.source).toBe('std::collections');
      expect(imports[1]?.source).toBe('serde');
      expect(imports[2]?.source).toBe('crate::models');
    });
  });

  describe('Edge cases', () => {
    it('returns empty array for malformed code', () => {
      const code = 'fn incomplete(';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toEqual([]);
    });

    it('handles empty file', () => {
      const code = '';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toEqual([]);
    });

    it('handles file with only comments', () => {
      const code = '// Just a comment\n/* Block comment */';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes).toEqual([]);
    });

    it('handles complex generics and lifetimes', () => {
      const code = "fn complex<'a, T: Clone + 'a>(value: &'a T) -> &'a T { value }";
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('complex');
      expect(nodes[0]?.signature).toContain("'a");
      expect(nodes[0]?.signature).toContain('T');
    });

    it('handles attributes', () => {
      const code = `
#[derive(Debug, Clone)]
struct Data {
    field: String
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.name).toBe('Data');
      expect(nodes[0]?.type).toBe('class');
    });

    it('parses file with mixed constructs', () => {
      const code = `
use std::collections::HashMap;

pub const VERSION: &str = "1.0";

pub struct Config {
    key: String,
}

impl Config {
    pub fn new(key: String) -> Self {
        Config { key }
    }
}

pub fn process() -> bool {
    true
}

trait Handler {
    fn handle(&self);
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes.length).toBeGreaterThan(0);

      const structs = nodes.filter((n) => n.type === 'class');
      const functions = nodes.filter((n) => n.type === 'function');
      const traits = nodes.filter((n) => n.type === 'interface');
      const constants = nodes.filter((n) => n.type === 'const');

      expect(structs).toHaveLength(1);
      expect(functions).toHaveLength(1);
      expect(traits).toHaveLength(1);
      expect(constants).toHaveLength(1);
    });
  });

  describe('Visibility modifiers', () => {
    it('detects pub visibility', () => {
      const code = 'pub fn public_fn() {}';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('detects pub(crate) as public', () => {
      const code = 'pub(crate) fn crate_fn() {}';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(true);
    });

    it('treats private as not exported', () => {
      const code = 'fn private_fn() {}';
      const nodes = parser.parse(code, 'test.rs');

      expect(nodes[0]?.exported).toBe(false);
    });
  });

  describe('Method signatures', () => {
    it('captures method line numbers', () => {
      const code = `
struct Test;

impl Test {
    fn method(&self) {
        // line 5
        // line 6
    }
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const test = nodes.find((n) => n.name === 'Test');
      const method = test?.methods?.[0];

      expect(method?.startLine).toBe(4);
      expect(method?.endLine).toBeGreaterThan(4);
    });

    it('captures complete method signatures', () => {
      const code = `
struct Service;

impl Service {
    fn process<T>(&self, value: T) -> Result<T, Error> {
        Ok(value)
    }
}
      `.trim();
      const nodes = parser.parse(code, 'test.rs');

      const service = nodes.find((n) => n.name === 'Service');
      const method = service?.methods?.[0];

      expect(method?.signature).toContain('process');
      expect(method?.signature).toContain('<T>');
    });
  });
});
