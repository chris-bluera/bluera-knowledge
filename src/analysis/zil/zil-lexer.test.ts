import { describe, it, expect } from 'vitest';
import { ZilLexer, TokenType, type Token } from './zil-lexer.js';

describe('ZilLexer', () => {
  const lexer = new ZilLexer();

  describe('basic tokens', () => {
    it('should tokenize angle brackets', () => {
      const tokens = lexer.tokenize('<>');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.LANGLE, value: '<' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RANGLE, value: '>' });
    });

    it('should tokenize parentheses', () => {
      const tokens = lexer.tokenize('()');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.LPAREN, value: '(' });
      expect(tokens[1]).toMatchObject({ type: TokenType.RPAREN, value: ')' });
    });

    it('should tokenize atoms (symbols)', () => {
      const tokens = lexer.tokenize('ROUTINE');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ROUTINE' });
    });

    it('should tokenize atoms with special characters', () => {
      const tokens = lexer.tokenize('EQUAL? FSET? IN?');
      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'EQUAL?' });
      expect(tokens[1]).toMatchObject({ type: TokenType.ATOM, value: 'FSET?' });
      expect(tokens[2]).toMatchObject({ type: TokenType.ATOM, value: 'IN?' });
    });

    it('should tokenize atoms with hyphens', () => {
      const tokens = lexer.tokenize('V-LOOK BRASS-LANTERN');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'V-LOOK' });
      expect(tokens[1]).toMatchObject({ type: TokenType.ATOM, value: 'BRASS-LANTERN' });
    });
  });

  describe('strings', () => {
    it('should tokenize simple strings', () => {
      const tokens = lexer.tokenize('"Hello, World!"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'Hello, World!' });
    });

    it('should tokenize strings with escaped quotes', () => {
      const tokens = lexer.tokenize('"He said \\"Hello\\""');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'He said "Hello"' });
    });

    it('should tokenize strings with escaped backslashes', () => {
      const tokens = lexer.tokenize('"path\\\\to\\\\file"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: 'path\\to\\file' });
    });

    it('should tokenize empty strings', () => {
      const tokens = lexer.tokenize('""');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.STRING, value: '' });
    });
  });

  describe('numbers', () => {
    it('should tokenize positive integers', () => {
      const tokens = lexer.tokenize('42');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '42' });
    });

    it('should tokenize negative integers', () => {
      const tokens = lexer.tokenize('-10');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '-10' });
    });

    it('should tokenize zero', () => {
      const tokens = lexer.tokenize('0');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.NUMBER, value: '0' });
    });
  });

  describe('comments', () => {
    it('should skip line comments starting with semicolon', () => {
      const tokens = lexer.tokenize('; This is a comment\nATOM');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM' });
    });

    it('should handle inline comments', () => {
      const tokens = lexer.tokenize('ATOM ; inline comment');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM' });
    });

    it('should handle multiple comment lines', () => {
      const tokens = lexer.tokenize('; comment 1\n; comment 2\nATOM');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM' });
    });
  });

  describe('whitespace', () => {
    it('should skip whitespace between tokens', () => {
      const tokens = lexer.tokenize('  ATOM1   ATOM2  ');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM1' });
      expect(tokens[1]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM2' });
    });

    it('should handle tabs and newlines', () => {
      const tokens = lexer.tokenize('ATOM1\t\nATOM2');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM1' });
      expect(tokens[1]).toMatchObject({ type: TokenType.ATOM, value: 'ATOM2' });
    });
  });

  describe('complex expressions', () => {
    it('should tokenize a simple routine', () => {
      const code = '<ROUTINE V-LOOK ()>';
      const tokens = lexer.tokenize(code);
      expect(tokens).toHaveLength(6);
      expect(tokens.map((t) => t.type)).toEqual([
        TokenType.LANGLE,
        TokenType.ATOM,
        TokenType.ATOM,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.RANGLE,
      ]);
    });

    it('should tokenize nested forms', () => {
      const code = '<COND (<EQUAL? ,FOO 1> <TELL "One">)>';
      const tokens = lexer.tokenize(code);

      // Verify key tokens are present
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TokenType.LANGLE);
      expect(types).toContain(TokenType.ATOM);
      expect(types).toContain(TokenType.STRING);
      expect(types).toContain(TokenType.NUMBER);
    });

    it('should tokenize INSERT-FILE directive', () => {
      const code = '<INSERT-FILE "GMACROS" T>';
      const tokens = lexer.tokenize(code);
      expect(tokens).toHaveLength(5);
      expect(tokens[1]).toMatchObject({ type: TokenType.ATOM, value: 'INSERT-FILE' });
      expect(tokens[2]).toMatchObject({ type: TokenType.STRING, value: 'GMACROS' });
      expect(tokens[3]).toMatchObject({ type: TokenType.ATOM, value: 'T' });
    });

    it('should tokenize OBJECT definition', () => {
      const code = '<OBJECT BRASS-LANTERN (DESC "brass lantern") (FLAGS LIGHTBIT)>';
      const tokens = lexer.tokenize(code);

      expect(tokens.find((t) => t.value === 'OBJECT')).toBeDefined();
      expect(tokens.find((t) => t.value === 'BRASS-LANTERN')).toBeDefined();
      expect(tokens.find((t) => t.value === 'brass lantern')).toBeDefined();
    });
  });

  describe('line tracking', () => {
    it('should track line numbers', () => {
      const code = 'ATOM1\nATOM2\nATOM3';
      const tokens = lexer.tokenize(code);

      expect(tokens[0]?.line).toBe(1);
      expect(tokens[1]?.line).toBe(2);
      expect(tokens[2]?.line).toBe(3);
    });

    it('should track column numbers', () => {
      const code = '  ATOM';
      const tokens = lexer.tokenize(code);

      expect(tokens[0]?.column).toBe(3); // 1-based, after 2 spaces
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const tokens = lexer.tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle only whitespace', () => {
      const tokens = lexer.tokenize('   \n\t  ');
      expect(tokens).toEqual([]);
    });

    it('should handle only comments', () => {
      const tokens = lexer.tokenize('; comment only');
      expect(tokens).toEqual([]);
    });

    it('should throw on unterminated string', () => {
      expect(() => lexer.tokenize('"unterminated')).toThrow('Unterminated string');
    });

    it('should handle comma prefix (global reference)', () => {
      const tokens = lexer.tokenize(',FOO');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: ',FOO' });
    });

    it('should handle period prefix (local reference)', () => {
      const tokens = lexer.tokenize('.BAR');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TokenType.ATOM, value: '.BAR' });
    });
  });
});
