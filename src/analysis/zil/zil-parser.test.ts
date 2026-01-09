import { describe, it, expect } from 'vitest';
import { ZilParser, type ZilForm, type ZilNode } from './zil-parser.js';

describe('ZilParser', () => {
  const parser = new ZilParser();

  describe('basic parsing', () => {
    it('should parse empty input', () => {
      const result = parser.parse('');
      expect(result.forms).toEqual([]);
    });

    it('should parse a simple form', () => {
      const result = parser.parse('<ROUTINE V-LOOK>');
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0]?.head).toBe('ROUTINE');
    });

    it('should parse form with arguments', () => {
      const result = parser.parse('<ROUTINE V-LOOK ()>');
      expect(result.forms).toHaveLength(1);

      const form = result.forms[0];
      expect(form?.head).toBe('ROUTINE');
      expect(form?.children).toHaveLength(2); // V-LOOK and ()
    });
  });

  describe('symbol extraction', () => {
    it('should extract ROUTINE as function symbol', () => {
      const result = parser.parse('<ROUTINE V-LOOK () <TELL "You see nothing.">>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'V-LOOK',
        kind: 'routine',
      });
    });

    it('should extract OBJECT as object symbol', () => {
      const result = parser.parse('<OBJECT BRASS-LANTERN (DESC "brass lantern")>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'BRASS-LANTERN',
        kind: 'object',
      });
    });

    it('should extract ROOM as room symbol', () => {
      const result = parser.parse('<ROOM WEST-OF-HOUSE (DESC "West of House")>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'WEST-OF-HOUSE',
        kind: 'room',
      });
    });

    it('should extract GLOBAL as global symbol', () => {
      const result = parser.parse('<GLOBAL SCORE 0>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'SCORE',
        kind: 'global',
      });
    });

    it('should extract CONSTANT as constant symbol', () => {
      const result = parser.parse('<CONSTANT M-BEG 1>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'M-BEG',
        kind: 'constant',
      });
    });

    it('should extract SYNTAX as verb/syntax symbol', () => {
      const result = parser.parse('<SYNTAX LOOK = V-LOOK>');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]).toMatchObject({
        name: 'LOOK',
        kind: 'syntax',
      });
    });

    it('should extract multiple symbols from file', () => {
      const code = `
<CONSTANT M-BEG 1>
<GLOBAL SCORE 0>
<ROUTINE V-LOOK ()>
<OBJECT LAMP>
`;
      const result = parser.parse(code);
      expect(result.symbols).toHaveLength(4);

      const kinds = result.symbols.map((s) => s.kind);
      expect(kinds).toContain('constant');
      expect(kinds).toContain('global');
      expect(kinds).toContain('routine');
      expect(kinds).toContain('object');
    });
  });

  describe('import extraction', () => {
    it('should extract INSERT-FILE as import', () => {
      const result = parser.parse('<INSERT-FILE "GMACROS" T>');
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
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
      const result = parser.parse(code);
      expect(result.imports).toHaveLength(2);
      expect(result.imports.map((i) => i.source)).toEqual(['GMACROS', 'PARSER']);
    });
  });

  describe('call extraction', () => {
    it('should extract calls from routine body', () => {
      const code = '<ROUTINE V-LOOK () <TELL "text"> <DESCRIBE-ROOM>>';
      const result = parser.parse(code);

      expect(result.calls).toBeDefined();
      expect(result.calls.length).toBeGreaterThan(0);

      // DESCRIBE-ROOM should be a call (not a special form)
      const callNames = result.calls.map((c) => c.callee);
      expect(callNames).toContain('DESCRIBE-ROOM');
    });

    it('should filter out special forms from calls', () => {
      const code = '<ROUTINE TEST () <COND (<EQUAL? 1 1> <TELL "yes">)>>';
      const result = parser.parse(code);

      const callNames = result.calls.map((c) => c.callee);
      // COND, EQUAL?, TELL are special forms - should not be in calls
      expect(callNames).not.toContain('COND');
      expect(callNames).not.toContain('EQUAL?');
      expect(callNames).not.toContain('TELL');
    });

    it('should include routine calls but not builtins', () => {
      const code = '<ROUTINE V-TAKE () <V-LOOK> <MOVE ,OBJ ,HERE>>';
      const result = parser.parse(code);

      const callNames = result.calls.map((c) => c.callee);
      expect(callNames).toContain('V-LOOK');
      // MOVE is a builtin, typically filtered
      expect(callNames).not.toContain('MOVE');
    });
  });

  describe('line tracking', () => {
    it('should track start and end lines for symbols', () => {
      const code = `
<ROUTINE V-LOOK ()
  <TELL "You see nothing special.">>
`;
      const result = parser.parse(code);
      expect(result.symbols).toHaveLength(1);

      const symbol = result.symbols[0];
      expect(symbol?.startLine).toBe(2); // Line where ROUTINE starts
      expect(symbol?.endLine).toBeGreaterThanOrEqual(3);
    });
  });

  describe('nested forms', () => {
    it('should parse deeply nested forms', () => {
      const code = '<COND (<AND (<EQUAL? ,X 1> <FSET? ,OBJ ,LIGHTBIT>) <RTRUE>>)>';
      const result = parser.parse(code);
      expect(result.forms).toHaveLength(1);

      // Should not throw and should have the nested structure
      const topForm = result.forms[0];
      expect(topForm?.head).toBe('COND');
    });
  });

  describe('signature extraction', () => {
    it('should extract routine signature with args', () => {
      const code = '<ROUTINE V-TAKE (OBJ "AUX" FLAG) <TELL "Taking...">>';
      const result = parser.parse(code);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.signature).toContain('V-TAKE');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed input gracefully', () => {
      // Missing closing angle bracket - should not throw, just return partial result
      const result = parser.parse('<ROUTINE V-LOOK');
      // Parser should handle gracefully
      expect(result).toBeDefined();
    });

    it('should handle empty forms', () => {
      const result = parser.parse('<>');
      expect(result.forms).toHaveLength(1);
      expect(result.forms[0]?.head).toBe('');
    });
  });
});
