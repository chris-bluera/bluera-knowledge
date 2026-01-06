import { describe, it, expect } from 'vitest';
import { estimateTokens, formatTokenCount } from './token.service.js';

describe('token.service', () => {
  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('estimates tokens for short text', () => {
      // "hello" = 5 chars, 5/3.5 = 1.43, ceil = 2
      expect(estimateTokens('hello')).toBe(2);
    });

    it('estimates tokens for longer text', () => {
      // 35 chars / 3.5 = 10 tokens
      const text = 'a'.repeat(35);
      expect(estimateTokens(text)).toBe(10);
    });

    it('rounds up token count', () => {
      // 7 chars / 3.5 = 2 tokens exactly
      expect(estimateTokens('abcdefg')).toBe(2);
      // 8 chars / 3.5 = 2.29, ceil = 3
      expect(estimateTokens('abcdefgh')).toBe(3);
    });
  });

  describe('formatTokenCount', () => {
    it('formats small counts without suffix', () => {
      expect(formatTokenCount(100)).toBe('~100');
      expect(formatTokenCount(999)).toBe('~999');
    });

    it('formats counts >= 1000 with k suffix', () => {
      expect(formatTokenCount(1000)).toBe('~1.0k');
      expect(formatTokenCount(1500)).toBe('~1.5k');
      expect(formatTokenCount(10000)).toBe('~10.0k');
    });

    it('formats zero', () => {
      expect(formatTokenCount(0)).toBe('~0');
    });
  });
});
