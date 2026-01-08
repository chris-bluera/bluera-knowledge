/**
 * Comprehensive tests for article-converter
 * Coverage: HTML to markdown conversion, article extraction, fallbacks, title extraction, error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { convertHtmlToMarkdown } from './article-converter.js';
import * as articleExtractor from '@extractus/article-extractor';
import * as markdownUtils from './markdown-utils.js';

// Mock article extractor
vi.mock('@extractus/article-extractor');

// Mock markdown utils
vi.mock('./markdown-utils.js');

describe('convertHtmlToMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
      title: 'Test Article',
      content: '<article><h1>Test</h1><p>Content</p></article>',
      description: null,
      author: null,
      source: null,
      published: null,
      image: null,
      links: [],
      type: null,
    });

    vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks).mockImplementation((html) => html);
    vi.mocked(markdownUtils.cleanupMarkdown).mockImplementation((md) => md);
  });

  describe('Article Extraction', () => {
    it('should extract article content from HTML', async () => {
      const html = '<html><body><article><h1>Title</h1><p>Content</p></article></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(vi.mocked(articleExtractor.extractFromHtml)).toHaveBeenCalledWith(
        html,
        'https://example.com'
      );
      expect(result.success).toBe(true);
    });

    it('should include title from extracted article', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Extracted Title',
        content: '<p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBe('Extracted Title');
    });

    it('should fallback to full HTML when extraction returns null', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue(null);

      const html = '<html><body><h1>Full HTML</h1></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
      // Should have processed the full HTML through markdown conversion
      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalledWith(html);
    });

    it('should fallback to full HTML when extraction returns empty content', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Title',
        content: '',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const html = '<html><body><h1>Full HTML</h1></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalledWith(html);
    });

    it('should fallback to full HTML when extraction returns undefined content', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Title',
        content: undefined,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const html = '<html><body><h1>Full HTML</h1></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalledWith(html);
    });

    it('should fallback to full HTML when extraction throws error', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockRejectedValue(new Error('Extraction failed'));

      const html = '<html><body><h1>Full HTML</h1></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalledWith(html);
    });

    it('should not include title when extraction returns empty title', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: '',
        content: '<p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBeUndefined();
    });

    it('should not include title when extraction returns undefined title', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: undefined,
        content: '<p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBeUndefined();
    });
  });

  describe('Markdown Conversion Pipeline', () => {
    it('should preprocess HTML for code blocks', async () => {
      const html = '<html><body><pre><code>test</code></pre></body></html>';
      await convertHtmlToMarkdown(html, 'https://example.com');

      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalled();
    });

    it('should cleanup markdown after conversion', async () => {
      await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(vi.mocked(markdownUtils.cleanupMarkdown)).toHaveBeenCalled();
    });

    it('should convert headings to ATX style', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Heading 1');
      expect(result.markdown).toContain('## Heading 2');
      expect(result.markdown).toContain('### Heading 3');
    });

    it('should convert code blocks to fenced style', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<pre><code class="language-javascript">const x = 1;</code></pre>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('```');
    });

    it('should convert links to inline style', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<p><a href="https://example.com">Link Text</a></p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('[Link Text](https://example.com)');
    });

    it('should convert tables with GFM plugin', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('|');
    });

    it('should handle empty anchor tags in headings', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<h1><a href="#anchor"></a>Heading with Anchor</h1>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Heading with Anchor');
      expect(result.markdown).not.toContain('[]()');
    });

    it('should normalize whitespace in headings', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<h1>Heading   with   spaces</h1>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.markdown).toContain('# Heading with spaces');
    });

    it('should not create empty headings', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Test',
        content: '<h1><a href="#anchor"></a></h1><p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(true);
      // Empty heading should not appear in markdown
      expect(result.markdown).not.toMatch(/^#\s*$/m);
    });
  });

  describe('Error Handling', () => {
    it('should return error result when conversion throws error', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockImplementation(() => {
        throw new Error('Fatal conversion error');
      });
      vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks).mockImplementation(() => {
        throw new Error('Fatal conversion error');
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.markdown).toBe('');
      expect(result.error).toBe('Fatal conversion error');
    });

    it('should handle non-Error thrown values', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockImplementation(() => {
        throw 'String error';
      });
      vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks).mockImplementation(() => {
        throw 'String error';
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should return empty markdown on error', async () => {
      vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks).mockImplementation(() => {
        throw new Error('Preprocessing failed');
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.markdown).toBe('');
    });

    it('should not include title on error', async () => {
      vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks).mockImplementation(() => {
        throw new Error('Preprocessing failed');
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.success).toBe(false);
      expect(result.title).toBeUndefined();
    });
  });

  describe('Empty and Malformed HTML', () => {
    it('should handle empty HTML string', async () => {
      const result = await convertHtmlToMarkdown('', 'https://example.com');

      expect(result.success).toBe(true);
    });

    it('should handle whitespace-only HTML', async () => {
      const result = await convertHtmlToMarkdown('   \n  \t  ', 'https://example.com');

      expect(result.success).toBe(true);
    });

    it('should handle malformed HTML', async () => {
      const html = '<html><body><div><p>Unclosed tags';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
    });

    it('should handle HTML with no content', async () => {
      const html = '<html><head><title>Title</title></head><body></body></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
    });

    it('should handle HTML with only navigation elements', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: null,
        content: undefined,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const html = '<html><nav><a href="/">Home</a></nav></html>';
      const result = await convertHtmlToMarkdown(html, 'https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('Complex Documentation Site HTML', () => {
    it('should handle MkDocs Material HTML structure', async () => {
      const mkdocsHtml = `
        <div class="md-content">
          <article class="md-content__inner md-typeset">
            <h1>Documentation</h1>
            <table class="highlighttable">
              <tbody>
                <tr>
                  <td class="linenos"><div><pre>1</pre></div></td>
                  <td class="code"><div><pre><code class="language-python">print("hello")</code></pre></div></td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      `;

      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Documentation',
        content: mkdocsHtml,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown(mkdocsHtml, 'https://example.com/docs');

      expect(result.success).toBe(true);
      expect(vi.mocked(markdownUtils.preprocessHtmlForCodeBlocks)).toHaveBeenCalledWith(mkdocsHtml);
    });

    it('should handle Sphinx documentation HTML', async () => {
      const sphinxHtml = `
        <div class="document">
          <div class="documentwrapper">
            <div class="bodywrapper">
              <div class="body" role="main">
                <h1>Sphinx Documentation</h1>
                <div class="highlight-python">
                  <div class="highlight">
                    <pre><code class="language-python">import os</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Sphinx Documentation',
        content: sphinxHtml,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown(sphinxHtml, 'https://example.com/docs');

      expect(result.success).toBe(true);
    });

    it('should handle nested code blocks with syntax highlighting', async () => {
      const complexHtml = `
        <div class="code-block">
          <pre><code class="hljs language-javascript">
            <span class="hljs-keyword">function</span> <span class="hljs-title">test</span>() {
              <span class="hljs-keyword">return</span> <span class="hljs-number">42</span>;
            }
          </code></pre>
        </div>
      `;

      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Code Example',
        content: complexHtml,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown(complexHtml, 'https://example.com');

      expect(result.success).toBe(true);
    });

    it('should handle documentation with table of contents', async () => {
      const htmlWithToc = `
        <div class="toc">
          <ul>
            <li><a href="#section1">Section 1</a></li>
            <li><a href="#section2">Section 2</a></li>
          </ul>
        </div>
        <div class="content">
          <h2 id="section1">Section 1</h2>
          <p>Content 1</p>
          <h2 id="section2">Section 2</h2>
          <p>Content 2</p>
        </div>
      `;

      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Documentation',
        content: htmlWithToc,
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown(htmlWithToc, 'https://example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('Title Extraction', () => {
    it('should preserve title from article extraction', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: 'Article Title from Metadata',
        content: '<h1>Heading Title</h1><p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBe('Article Title from Metadata');
    });

    it('should handle Unicode characters in title', async () => {
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: '日本語のタイトル 🎉',
        content: '<p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBe('日本語のタイトル 🎉');
    });

    it('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(500);
      vi.mocked(articleExtractor.extractFromHtml).mockResolvedValue({
        title: longTitle,
        content: '<p>Content</p>',
        description: null,
        author: null,
        source: null,
        published: null,
        image: null,
        links: [],
        type: null,
      });

      const result = await convertHtmlToMarkdown('<html></html>', 'https://example.com');

      expect(result.title).toBe(longTitle);
    });
  });
});
