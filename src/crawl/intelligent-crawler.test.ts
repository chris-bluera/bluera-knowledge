/**
 * Comprehensive tests for IntelligentCrawler
 * Coverage: mode selection, network errors, loop prevention, memory, events, stop, limits, domain filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IntelligentCrawler } from './intelligent-crawler.js';
import type { CrawlProgress } from './intelligent-crawler.js';
import axios from 'axios';
import * as articleConverter from './article-converter.js';

// Mock dependencies
vi.mock('axios');
vi.mock('./claude-client.js');
vi.mock('./bridge.js');
vi.mock('./article-converter.js');

// Import mocked classes after mocking
const { ClaudeClient } = await import('./claude-client.js');
const { PythonBridge } = await import('./bridge.js');

describe('IntelligentCrawler', () => {
  let crawler: IntelligentCrawler;
  let mockClaudeClient: any;
  let mockPythonBridge: any;
  let progressEvents: CrawlProgress[];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    progressEvents = [];

    // Setup ClaudeClient mock
    mockClaudeClient = {
      determineCrawlUrls: vi.fn(),
      extractContent: vi.fn(),
    };
    vi.mocked(ClaudeClient).mockImplementation(function() { return mockClaudeClient; });

    // Setup PythonBridge mock
    mockPythonBridge = {
      crawl: vi.fn(),
      fetchHeadless: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(PythonBridge).mockImplementation(function() { return mockPythonBridge; });

    // Setup axios mock
    vi.mocked(axios.get).mockResolvedValue({
      data: '<html><body><h1>Test</h1><a href="https://example.com/page1">Link</a></body></html>',
    });

    // Setup convertHtmlToMarkdown mock
    vi.mocked(articleConverter.convertHtmlToMarkdown).mockResolvedValue({
      success: true,
      markdown: '# Test\n\nContent',
      title: 'Test Page',
    });

    // Create crawler instance
    crawler = new IntelligentCrawler();

    // Listen to progress events
    crawler.on('progress', (progress: CrawlProgress) => {
      progressEvents.push(progress);
    });
  });

  afterEach(async () => {
    await crawler.stop();
  });

  describe('Mode Selection', () => {
    it('should use intelligent mode when crawlInstruction is provided', async () => {
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls: ['https://example.com/page1'],
        reasoning: 'Found relevant page',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all docs',
      })) {
        results.push(result);
      }

      expect(mockClaudeClient.determineCrawlUrls).toHaveBeenCalledOnce();
      expect(results).toHaveLength(1);
    });

    it('should use simple mode when crawlInstruction is empty string', async () => {
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [{ links: [] }],
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: '',
      })) {
        results.push(result);
      }

      expect(mockClaudeClient.determineCrawlUrls).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should use simple mode when crawlInstruction is undefined', async () => {
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [{ links: [] }],
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {})) {
        results.push(result);
      }

      expect(mockClaudeClient.determineCrawlUrls).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should force simple mode when simple option is true', async () => {
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [{ links: [] }],
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all docs',
        simple: true,
      })) {
        results.push(result);
      }

      expect(mockClaudeClient.determineCrawlUrls).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });
  });

  describe('Network Error Handling', () => {
    it('should handle timeout errors gracefully', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        code: 'ETIMEDOUT',
        message: 'timeout of 30000ms exceeded',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      // Should fail to fetch and emit error but not crash
      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle DNS failures', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND invalid.example.com',
      });

      const results = [];
      for await (const result of crawler.crawl('https://invalid.example.com', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle 404 errors', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        response: { status: 404 },
        message: 'Request failed with status code 404',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com/404', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle 500 errors', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        response: { status: 500 },
        message: 'Request failed with status code 500',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should handle network connection refused', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:80',
      });

      const results = [];
      for await (const result of crawler.crawl('http://localhost', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should not visit the same URL twice in simple mode', async () => {
      const circular = 'https://example.com/page1';
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [{ links: [circular] }], // Link back to itself
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: `<html><body><a href="${circular}">Self</a></body></html>` });

      const results = [];
      for await (const result of crawler.crawl(circular, { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      // Should only crawl once despite circular link
      expect(results).toHaveLength(1);
      expect(vi.mocked(axios.get)).toHaveBeenCalledTimes(1);
    });

    it('should not visit the same URL twice in intelligent mode', async () => {
      const duplicate = 'https://example.com/page1';
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls: [duplicate, duplicate, duplicate], // Same URL repeated
        reasoning: 'Found duplicate URLs',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all',
        maxPages: 10,
      })) {
        results.push(result);
      }

      // Should only crawl the URL once
      expect(results).toHaveLength(1);
    });

    it('should handle circular references across multiple pages', async () => {
      const page1 = 'https://example.com/page1';
      const page2 = 'https://example.com/page2';

      mockPythonBridge.crawl
        .mockResolvedValueOnce({ pages: [{ links: [page2] }] }) // page1 -> page2
        .mockResolvedValueOnce({ pages: [{ links: [page1] }] }); // page2 -> page1

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: `<html><body><a href="${page2}">Next</a></body></html>` })
        .mockResolvedValueOnce({ data: `<html><body><a href="${page1}">Back</a></body></html>` });

      const results = [];
      for await (const result of crawler.crawl(page1, { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      // Should crawl both pages once, not infinitely
      expect(results).toHaveLength(2);
    });
  });

  describe('Memory Management', () => {
    it('should track visited URLs in a Set', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      // Verify visited set is working by attempting to crawl again
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }
      // Second crawl should also work (visited set cleared)
      expect(results).toHaveLength(2);
    });

    it('should clear visited set on new crawl', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      // First crawl
      const results1 = [];
      for await (const result of crawler.crawl('https://example.com/a', { simple: true })) {
        results1.push(result);
      }
      expect(results1).toHaveLength(1);

      // Second crawl with same URL should work (set was cleared)
      const results2 = [];
      for await (const result of crawler.crawl('https://example.com/a', { simple: true })) {
        results2.push(result);
      }
      expect(results2).toHaveLength(1);
    });
  });

  describe('Event Emission', () => {
    it('should emit start event', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      const startEvents = progressEvents.filter((e) => e.type === 'start');
      expect(startEvents).toHaveLength(1);
      expect(startEvents[0]?.pagesVisited).toBe(0);
      expect(startEvents[0]?.totalPages).toBe(10);
    });

    it('should emit page events', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      const pageEvents = progressEvents.filter((e) => e.type === 'page');
      expect(pageEvents.length).toBeGreaterThan(0);
      expect(pageEvents[0]?.currentUrl).toBe('https://example.com');
    });

    it('should emit complete event', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      const completeEvents = progressEvents.filter((e) => e.type === 'complete');
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0]?.pagesVisited).toBe(1);
    });

    it('should emit strategy events in intelligent mode', async () => {
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls: ['https://example.com/page1'],
        reasoning: 'Strategy reasoning',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all',
      })) {
        results.push(result);
      }

      const strategyEvents = progressEvents.filter((e) => e.type === 'strategy');
      expect(strategyEvents.length).toBeGreaterThanOrEqual(1);
      expect(strategyEvents.some((e) => e.message?.includes('Strategy reasoning'))).toBe(true);
    });

    it('should emit extraction events when extract instruction provided', async () => {
      mockClaudeClient.extractContent.mockResolvedValue('Extracted content');
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        simple: true,
        extractInstruction: 'Extract pricing',
      })) {
        results.push(result);
      }

      const extractionEvents = progressEvents.filter((e) => e.type === 'extraction');
      expect(extractionEvents.length).toBeGreaterThan(0);
    });

    it('should emit error events on page fetch failures', async () => {
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0]?.error).toBeDefined();
    });
  });

  describe('Stop Functionality', () => {
    it('should stop crawling when stop is called', async () => {
      mockPythonBridge.crawl.mockImplementation(async () => {
        // Simulate slow crawl
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { pages: [{ links: ['https://example.com/next'] }] };
      });

      const results = [];
      const crawlPromise = (async () => {
        for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 100 })) {
          results.push(result);
        }
      })();

      // Stop after a short delay
      setTimeout(() => crawler.stop(), 50);

      await crawlPromise;

      // Should have stopped early
      expect(results.length).toBeLessThan(100);
      expect(mockPythonBridge.stop).toHaveBeenCalled();
    });

    it('should reset stopped flag on new crawl', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      // First crawl with stop
      await crawler.stop();

      // Second crawl should work
      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
    });
  });

  describe('Max Pages Enforcement', () => {
    it('should respect maxPages limit in simple mode', async () => {
      const links = Array.from({ length: 20 }, (_, i) => `https://example.com/page${i}`);
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 3 })) {
        results.push(result);
      }

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should respect maxPages limit in intelligent mode', async () => {
      const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/page${i}`);
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls,
        reasoning: 'Found many pages',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all',
        maxPages: 5,
      })) {
        results.push(result);
      }

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should use default maxPages of 50', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      const startEvent = progressEvents.find((e) => e.type === 'start');
      expect(startEvent?.totalPages).toBe(50);
    });
  });

  describe('Same-Domain Filtering Logic', () => {
    it('should filter out different domain links in simple mode', async () => {
      mockPythonBridge.crawl
        .mockResolvedValueOnce({
          pages: [
            {
              links: [
                'https://example.com/page1', // Same domain
                'https://other.com/page2', // Different domain
              ],
            },
          ],
        })
        .mockResolvedValueOnce({ pages: [{ links: [] }] });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: '<html><body>Seed</body></html>' })
        .mockResolvedValueOnce({ data: '<html><body>Page1</body></html>' });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      // Should only crawl same-domain link
      expect(results).toHaveLength(2); // Seed + page1
      expect(results.some((r) => r.url.includes('other.com'))).toBe(false);
    });

    it('should allow subdomain links', async () => {
      mockPythonBridge.crawl
        .mockResolvedValueOnce({
          pages: [{ links: ['https://docs.example.com/page1'] }],
        })
        .mockResolvedValueOnce({ pages: [{ links: [] }] });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: '<html><body>Seed</body></html>' })
        .mockResolvedValueOnce({ data: '<html><body>Page1</body></html>' });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      expect(results).toHaveLength(2);
      expect(results.some((r) => r.url.includes('docs.example.com'))).toBe(true);
    });

    it('should handle invalid URLs in link extraction', async () => {
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [
          {
            links: [
              'not-a-valid-url',
              'javascript:void(0)',
              'mailto:test@example.com',
            ],
          },
        ],
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      // Should only crawl the seed URL
      expect(results).toHaveLength(1);
    });
  });

  describe('Intelligent Mode Fallback', () => {
    it('should fallback to simple mode when Claude strategy fails', async () => {
      mockClaudeClient.determineCrawlUrls.mockRejectedValue(new Error('Claude API error'));
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all docs',
      })) {
        results.push(result);
      }

      // Should still crawl using simple mode
      expect(results).toHaveLength(1);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.some((e) => e.message?.includes('falling back to simple mode'))).toBe(true);
    });
  });

  describe('Content Extraction', () => {
    it('should extract content when extractInstruction provided', async () => {
      mockClaudeClient.extractContent.mockResolvedValue('Extracted pricing info');
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        simple: true,
        extractInstruction: 'Extract pricing',
      })) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0]?.extracted).toBe('Extracted pricing info');
      expect(mockClaudeClient.extractContent).toHaveBeenCalledWith(
        expect.any(String),
        'Extract pricing',
      );
    });

    it('should continue without extraction if extraction fails', async () => {
      mockClaudeClient.extractContent.mockRejectedValue(new Error('Extraction failed'));
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        simple: true,
        extractInstruction: 'Extract pricing',
      })) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0]?.extracted).toBeUndefined();
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.some((e) => e.message?.includes('storing raw markdown'))).toBe(true);
    });

    it('should not extract when extractInstruction is empty', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        simple: true,
        extractInstruction: '',
      })) {
        results.push(result);
      }

      expect(results).toHaveLength(1);
      expect(results[0]?.extracted).toBeUndefined();
      expect(mockClaudeClient.extractContent).not.toHaveBeenCalled();
    });
  });

  describe('Link Extraction Error Handling', () => {
    it('should throw error when Python bridge fails', async () => {
      mockPythonBridge.crawl.mockRejectedValue(new Error('Network timeout'));

      const crawler = new IntelligentCrawler();
      // Access private property for testing
      (crawler as any).pythonBridge = mockPythonBridge;

      await expect((crawler as any).extractLinks('https://example.com')).rejects.toThrow(
        'Link extraction failed'
      );
    });

    it('should throw error on invalid response structure', async () => {
      // Return a response without pages array
      mockPythonBridge.crawl.mockResolvedValue({ invalid: 'structure' });

      const crawler = new IntelligentCrawler();
      (crawler as any).pythonBridge = mockPythonBridge;

      await expect((crawler as any).extractLinks('https://example.com')).rejects.toThrow(
        'Invalid crawl response structure'
      );
    });

    it('should throw error when pages array is empty', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [] });

      const crawler = new IntelligentCrawler();
      (crawler as any).pythonBridge = mockPythonBridge;

      await expect((crawler as any).extractLinks('https://example.com')).rejects.toThrow(
        'Invalid crawl response structure'
      );
    });

    it('should use headless mode for link extraction when enabled', async () => {
      const headlessResult = {
        html: '<html/>',
        markdown: 'test',
        links: ['https://example.com/page2', 'https://example.com/page3'],
      };
      mockPythonBridge.fetchHeadless.mockResolvedValue(headlessResult);

      const crawler = new IntelligentCrawler();
      (crawler as any).pythonBridge = mockPythonBridge;

      const links = await (crawler as any).extractLinks('https://example.com', true);

      expect(mockPythonBridge.fetchHeadless).toHaveBeenCalledWith('https://example.com');
      expect(mockPythonBridge.crawl).not.toHaveBeenCalled();
      expect(links).toEqual(['https://example.com/page2', 'https://example.com/page3']);
    });

    it('should use regular crawl when headless is disabled', async () => {
      mockPythonBridge.crawl.mockResolvedValue({
        pages: [{ links: ['https://example.com/page1'] }],
      });

      const crawler = new IntelligentCrawler();
      (crawler as any).pythonBridge = mockPythonBridge;

      const links = await (crawler as any).extractLinks('https://example.com', false);

      expect(mockPythonBridge.crawl).toHaveBeenCalledWith('https://example.com');
      expect(mockPythonBridge.fetchHeadless).not.toHaveBeenCalled();
      expect(links).toEqual(['https://example.com/page1']);
    });

    it('should continue crawling other pages when link extraction fails in simple mode', async () => {
      // First page succeeds, link extraction fails, second page succeeds
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls: ['https://example.com/page1', 'https://example.com/page2'],
        reasoning: 'Test URLs',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: '<html><body>Seed</body></html>' }) // Seed page
        .mockResolvedValueOnce({ data: '<html><body>Page1</body></html>' }) // First URL
        .mockResolvedValueOnce({ data: '<html><body>Page2</body></html>' }); // Second URL

      // Make link extraction fail for first URL only
      mockPythonBridge.crawl
        .mockRejectedValueOnce(new Error('Link extraction failed'))
        .mockResolvedValueOnce({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all',
      })) {
        results.push(result);
      }

      // Should successfully crawl both URLs despite link extraction failure
      expect(results).toHaveLength(2);
      expect(results[0]?.url).toBe('https://example.com/page1');
      expect(results[1]?.url).toBe('https://example.com/page2');
    });
  });

  describe('HTML to Markdown Conversion', () => {
    it('should convert HTML to markdown for each page', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      expect(vi.mocked(articleConverter.convertHtmlToMarkdown)).toHaveBeenCalledWith(
        expect.any(String),
        'https://example.com',
      );
      expect(results[0]?.markdown).toBe('# Test\n\nContent');
    });

    it('should include title when available', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });
      vi.mocked(articleConverter.convertHtmlToMarkdown).mockResolvedValue({
        success: true,
        markdown: '# Test',
        title: 'Test Page Title',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      expect(results[0]?.title).toBe('Test Page Title');
    });

    it('should handle conversion failures', async () => {
      mockPythonBridge.crawl.mockResolvedValue({ pages: [{ links: [] }] });
      vi.mocked(articleConverter.convertHtmlToMarkdown).mockResolvedValue({
        success: false,
        markdown: '',
        error: 'Conversion error',
      });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true })) {
        results.push(result);
      }

      // Should fail to create result
      expect(results).toHaveLength(0);
      const errorEvents = progressEvents.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Simple Mode Depth Control', () => {
    it('should respect depth limit of 2 in simple mode', async () => {
      mockPythonBridge.crawl
        .mockResolvedValueOnce({ pages: [{ links: ['https://example.com/depth1'] }] })
        .mockResolvedValueOnce({ pages: [{ links: ['https://example.com/depth2'] }] })
        .mockResolvedValueOnce({ pages: [{ links: ['https://example.com/depth3'] }] });

      vi.mocked(axios.get).mockResolvedValue({ data: '<html><body>Test</body></html>' });

      const results = [];
      for await (const result of crawler.crawl('https://example.com', { simple: true, maxPages: 10 })) {
        results.push(result);
      }

      // Should stop at depth 2 (seed=0, depth1=1, depth2=2)
      expect(results.length).toBeLessThanOrEqual(3);
      expect(results.every((r) => (r.depth ?? 0) <= 2)).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    it('should continue crawling other pages after one page fails', async () => {
      mockClaudeClient.determineCrawlUrls.mockResolvedValue({
        urls: ['https://example.com/fail', 'https://example.com/success'],
        reasoning: 'Test URLs',
      });

      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: '<html><body>Seed page</body></html>' }) // Seed URL fetch
        .mockRejectedValueOnce(new Error('Failed to fetch')) // First URL fails
        .mockResolvedValueOnce({ data: '<html><body>Success</body></html>' }); // Second URL succeeds

      const results = [];
      for await (const result of crawler.crawl('https://example.com', {
        crawlInstruction: 'Find all',
      })) {
        results.push(result);
      }

      // Should successfully crawl the second URL
      expect(results).toHaveLength(1);
      expect(results[0]?.url).toBe('https://example.com/success');
    });
  });
});
