import { describe, it, expect } from 'vitest';
import { extractSnippet } from './snippet.service.js';

describe('SnippetService', () => {
  describe('extractSnippet', () => {
    it('returns full content when shorter than maxLength', () => {
      const content = 'Short content';
      const snippet = extractSnippet(content, 'query');
      expect(snippet).toBe('Short content');
    });

    it('truncates long content when no query terms match', () => {
      const content = 'A'.repeat(300);
      const snippet = extractSnippet(content, 'nonexistent');
      expect(snippet.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(snippet).toContain('...');
    });

    it('truncates when query has no terms longer than 2 chars', () => {
      const content = 'A'.repeat(300);
      const snippet = extractSnippet(content, 'a b c');
      expect(snippet.length).toBeLessThanOrEqual(203);
      expect(snippet).toContain('...');
    });

    it('extracts snippet around single query term match', () => {
      const content =
        'The quick brown fox jumps over the lazy dog. ' +
        'This is some filler text to make the content longer. ' +
        'Here is the important keyword we want to find. ' +
        'More filler text at the end to extend the content.';
      const snippet = extractSnippet(content, 'keyword');
      expect(snippet).toContain('keyword');
      expect(snippet).toContain('important');
    });

    it('extracts snippet around multiple clustered query terms', () => {
      const content =
        'Unrelated text at the start. '.repeat(10) +
        'Here is the target area with multiple keywords: search query terms matching. ' +
        'Unrelated text at the end. '.repeat(10);
      const snippet = extractSnippet(content, 'target keywords search');
      expect(snippet).toContain('target');
      expect(snippet).toContain('keywords');
    });

    it('normalizes whitespace in content', () => {
      const content = 'Multiple    spaces   and\n\nnewlines\t\ttabs';
      const snippet = extractSnippet(content, 'query');
      expect(snippet).toBe('Multiple spaces and newlines tabs');
    });

    it('filters out query terms shorter than 3 characters', () => {
      const content = 'The quick brown fox jumps over the lazy dog';
      const snippet = extractSnippet(content, 'a b the quick fox');
      // Should only match 'quick' and 'fox', not 'a', 'b', 'the'
      expect(snippet).toContain('quick');
      expect(snippet).toContain('fox');
    });

    it('adds ellipsis at start when snippet is from middle', () => {
      const content = 'A'.repeat(100) + ' target ' + 'B'.repeat(100);
      const snippet = extractSnippet(content, 'target', { maxLength: 50 });
      expect(snippet.startsWith('...')).toBe(true);
    });

    it('adds ellipsis at end when snippet ends before content end', () => {
      const content = 'target ' + 'A'.repeat(200);
      const snippet = extractSnippet(content, 'target', { maxLength: 50 });
      expect(snippet.endsWith('...')).toBe(true);
    });

    it('adds ellipsis at both ends when snippet is from middle', () => {
      const content = 'A'.repeat(200) + ' target ' + 'B'.repeat(200);
      const snippet = extractSnippet(content, 'target', { maxLength: 100 });
      expect(snippet.startsWith('...')).toBe(true);
      expect(snippet.endsWith('...')).toBe(true);
    });

    it('respects custom maxLength option', () => {
      const content = 'A'.repeat(500);
      const snippet = extractSnippet(content, 'nonexistent', { maxLength: 50 });
      expect(snippet.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    it('respects custom contextChars option', () => {
      const content = 'A'.repeat(100) + ' target ' + 'B'.repeat(100);
      const snippet = extractSnippet(content, 'target', { contextChars: 20 });
      expect(snippet).toContain('target');
    });

    it('tries to break at word boundaries for start', () => {
      const content = 'This is some preamble text. And here is the target word in context.';
      const snippet = extractSnippet(content, 'target', { maxLength: 40 });
      // Should contain target
      expect(snippet).toContain('target');
    });

    it('tries to break at word boundaries for end', () => {
      const content = 'The target word is here. Followed by more text that continues.';
      const snippet = extractSnippet(content, 'target', { maxLength: 40 });
      // Should contain target and use ellipsis
      expect(snippet).toContain('target');
      expect(snippet.endsWith('...')).toBe(true);
    });

    it('handles content at exact maxLength', () => {
      const content = 'A'.repeat(200);
      const snippet = extractSnippet(content, 'query', { maxLength: 200 });
      expect(snippet.length).toBeLessThanOrEqual(203);
    });

    it('handles query with case-insensitive matching', () => {
      const content = 'The TARGET word is here in different case';
      const snippet = extractSnippet(content, 'target');
      expect(snippet).toContain('TARGET');
    });

    it('finds best position when multiple query terms appear', () => {
      const content =
        'First occurrence of term. ' +
        'A'.repeat(200) +
        ' Second occurrence with more terms from query nearby. ' +
        'A'.repeat(200);
      const snippet = extractSnippet(content, 'term query nearby', { maxLength: 100 });
      expect(snippet).toContain('Second');
      expect(snippet).toContain('term');
    });

    it('handles empty query string', () => {
      const content = 'A'.repeat(300);
      const snippet = extractSnippet(content, '');
      expect(snippet.length).toBeLessThanOrEqual(203);
      expect(snippet).toContain('...');
    });

    it('handles content with only whitespace', () => {
      const content = '    ';
      const snippet = extractSnippet(content, 'query');
      expect(snippet).toBe('');
    });

    it('calculates proximity score correctly', () => {
      // Create content where terms are closer together in one location
      const content =
        'distant word here. ' +
        'A'.repeat(300) +
        ' clustered search query terms all together here ' +
        'A'.repeat(300);
      const snippet = extractSnippet(content, 'search query terms', { maxLength: 100 });
      expect(snippet).toContain('clustered');
      expect(snippet).toContain('search');
      expect(snippet).toContain('query');
      expect(snippet).toContain('terms');
    });

    it('truncates at word boundary when space is found', () => {
      const content = 'The quick brown fox jumps over the lazy dog and continues with more text';
      const snippet = extractSnippet(content, 'nonexistent', { maxLength: 30 });
      // Should truncate and add ellipsis
      expect(snippet.endsWith('...')).toBe(true);
      expect(snippet.length).toBeLessThanOrEqual(33);
    });

    it('uses fallback truncation when no good word boundary', () => {
      const content = 'A'.repeat(50) + ' X ' + 'B'.repeat(200);
      const snippet = extractSnippet(content, 'nonexistent', { maxLength: 60 });
      expect(snippet.length).toBeLessThanOrEqual(63);
      expect(snippet).toContain('...');
    });

    it('handles content at start edge with maxLength adjustment', () => {
      const content = 'start term here ' + 'A'.repeat(200);
      const snippet = extractSnippet(content, 'start', { maxLength: 50 });
      expect(snippet.startsWith('...')).toBe(false);
      expect(snippet.endsWith('...')).toBe(true);
    });

    it('handles content at end edge with maxLength adjustment', () => {
      const content = 'A'.repeat(200) + ' end term here';
      const snippet = extractSnippet(content, 'end', { maxLength: 50 });
      expect(snippet.startsWith('...')).toBe(true);
      expect(snippet.endsWith('...')).toBe(false);
    });

    it('finds position when first term array element exists', () => {
      const content = 'Simple test with term';
      const snippet = extractSnippet(content, 'test term');
      expect(snippet).toContain('test');
      expect(snippet).toContain('term');
    });

    it('scores positions based on unique nearby terms', () => {
      const content =
        'repeated repeated repeated. ' +
        'A'.repeat(100) +
        ' diverse unique different varied terms here ' +
        'A'.repeat(100);
      const snippet = extractSnippet(content, 'diverse unique different varied', {
        maxLength: 100,
      });
      expect(snippet).toContain('diverse');
      expect(snippet).toContain('unique');
    });

    it('handles very long content efficiently', () => {
      const content = 'A'.repeat(10000) + ' needle ' + 'B'.repeat(10000);
      const snippet = extractSnippet(content, 'needle', { maxLength: 100 });
      expect(snippet).toContain('needle');
      expect(snippet.length).toBeLessThanOrEqual(106); // 100 + '...' on both sides
    });
  });
});
