import { describe, it, expect } from 'vitest';
import { ZilAdapter } from './zil-adapter.js';
import type { LanguageAdapter } from '../language-adapter.js';

describe('ZilAdapter', () => {
  const adapter = new ZilAdapter();

  describe('interface compliance', () => {
    it('should implement LanguageAdapter interface', () => {
      // Type check - this should compile without error
      const _: LanguageAdapter = adapter;
      expect(adapter.languageId).toBe('zil');
      expect(adapter.extensions).toContain('.zil');
      expect(adapter.displayName).toBeDefined();
    });

    it('should have correct extensions', () => {
      expect(adapter.extensions).toEqual(['.zil', '.mud']);
    });
  });

  describe('parse', () => {
    it('should return CodeNode[] for routines', () => {
      const code = '<ROUTINE V-LOOK () <TELL "You see nothing.">>';
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'function',
        name: 'V-LOOK',
        exported: true,
      });
    });

    it('should return CodeNode[] for objects', () => {
      const code = '<OBJECT BRASS-LANTERN (DESC "brass lantern")>';
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'const', // Objects map to const
        name: 'BRASS-LANTERN',
      });
    });

    it('should return CodeNode[] for globals', () => {
      const code = '<GLOBAL SCORE 0>';
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({
        type: 'const',
        name: 'SCORE',
      });
    });

    it('should include line numbers', () => {
      const code = `
<ROUTINE V-LOOK ()
  <TELL "text">>
`;
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.startLine).toBe(2);
      expect(nodes[0]?.endLine).toBeGreaterThanOrEqual(3);
    });

    it('should include signature for routines', () => {
      const code = '<ROUTINE V-TAKE (OBJ) <TELL "Taking">>';
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(1);
      expect(nodes[0]?.signature).toContain('V-TAKE');
      expect(nodes[0]?.signature).toContain('OBJ');
    });

    it('should parse multiple symbols', () => {
      const code = `
<CONSTANT M-BEG 1>
<GLOBAL SCORE 0>
<ROUTINE V-LOOK ()>
<OBJECT LAMP>
`;
      const nodes = adapter.parse(code, 'test.zil');

      expect(nodes).toHaveLength(4);
    });
  });

  describe('extractImports', () => {
    it('should return ImportInfo[] for INSERT-FILE', () => {
      const code = '<INSERT-FILE "GMACROS" T>';
      const imports = adapter.extractImports(code, 'test.zil');

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'GMACROS',
        specifiers: [],
        isType: false,
      });
    });

    it('should extract multiple imports', () => {
      const code = `
<INSERT-FILE "GMACROS" T>
<INSERT-FILE "PARSER" T>
`;
      const imports = adapter.extractImports(code, 'test.zil');

      expect(imports).toHaveLength(2);
      expect(imports.map((i) => i.source)).toEqual(['GMACROS', 'PARSER']);
    });

    it('should return empty array when no imports', () => {
      const code = '<ROUTINE V-LOOK ()>';
      const imports = adapter.extractImports(code, 'test.zil');

      expect(imports).toEqual([]);
    });
  });

  describe('chunk', () => {
    it('should chunk by top-level forms', () => {
      const code = `<ROUTINE V-LOOK ()
  <TELL "text">>

<OBJECT LAMP
  (DESC "lamp")>`;

      const chunks = adapter.chunk?.(code, 'test.zil');

      expect(chunks).toBeDefined();
      expect(chunks).toHaveLength(2);
    });

    it('should include symbol metadata in chunks', () => {
      const code = '<ROUTINE V-LOOK () <TELL "text">>';
      const chunks = adapter.chunk?.(code, 'test.zil');

      expect(chunks).toHaveLength(1);
      expect(chunks?.[0]).toMatchObject({
        symbolName: 'V-LOOK',
        symbolKind: 'routine',
      });
    });

    it('should preserve original content in chunks', () => {
      const code = '<ROUTINE V-LOOK () <TELL "text">>';
      const chunks = adapter.chunk?.(code, 'test.zil');

      expect(chunks?.[0]?.content).toContain('ROUTINE');
      expect(chunks?.[0]?.content).toContain('V-LOOK');
    });
  });

  describe('analyzeCallRelationships', () => {
    it('should return GraphEdge[] for calls', () => {
      const code = '<ROUTINE V-LOOK () <V-DESCRIBE>>';
      const edges = adapter.analyzeCallRelationships?.(code, 'test.zil');

      expect(edges).toBeDefined();
      expect(edges?.length).toBeGreaterThan(0);

      const callEdge = edges?.find((e) => e.type === 'calls');
      expect(callEdge).toBeDefined();
      expect(callEdge?.to).toContain('V-DESCRIBE');
    });

    it('should not include special forms as calls', () => {
      const code = '<ROUTINE TEST () <COND (<EQUAL? 1 1> <RTRUE>)>>';
      const edges = adapter.analyzeCallRelationships?.(code, 'test.zil');

      const callees = edges?.map((e) => e.to) ?? [];
      expect(callees).not.toContain('COND');
      expect(callees).not.toContain('EQUAL?');
      expect(callees).not.toContain('RTRUE');
    });

    it('should set caller as from field', () => {
      const code = '<ROUTINE V-LOOK () <MY-HELPER>>';
      const edges = adapter.analyzeCallRelationships?.(code, 'test.zil');

      expect(edges?.[0]?.from).toContain('V-LOOK');
    });
  });
});
