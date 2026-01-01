import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { PythonBridge } from '../../src/crawl/bridge.js';
import { TestHTMLServer } from '../fixtures/test-server.js';

describe('Python Bridge Integration Tests', () => {
  let bridge: PythonBridge;
  let server: TestHTMLServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new TestHTMLServer();
    baseUrl = await server.start();
  }, 30000);

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(async () => {
    bridge = new PythonBridge();
    await bridge.start();
  }, 30000);

  afterEach(async () => {
    await bridge.stop();
  });

  describe('Process Lifecycle', () => {
    it('spawns real Python process', async () => {
      // Verify process exists by making a successful call
      const result = await bridge.crawl(baseUrl);
      expect(result.pages).toBeDefined();
      expect(result.pages.length).toBeGreaterThan(0);
    }, 30000);

    it('can create new bridge after stopping', async () => {
      // Stop the current bridge
      await bridge.stop();

      // Create and start a new bridge
      const newBridge = new PythonBridge();
      await newBridge.start();

      try {
        // Verify the new bridge works
        const result = await newBridge.crawl(`${baseUrl}/about`);
        expect(result.pages).toBeDefined();
        expect(result.pages[0].content).toContain('About');
      } finally {
        await newBridge.stop();
      }
    }, 30000);
  });

  describe('Real crawl4ai Responses', () => {
    it('validates simple crawl response format', async () => {
      // Use test server (local HTTP, fast)
      const result = await bridge.crawl(`${baseUrl}/page1`);

      // Verify response structure matches schema
      expect(result.pages).toBeDefined();
      expect(result.pages).toBeInstanceOf(Array);
      expect(result.pages.length).toBeGreaterThan(0);

      const page = result.pages[0];
      expect(page.url).toBeDefined();
      expect(page.title).toBeDefined();
      expect(page.content).toBeDefined();
      expect(page.links).toBeInstanceOf(Array);
      expect(page.crawledAt).toBeDefined();
    }, 30000);

    it('validates link format from real crawl4ai (CRITICAL: catches the bug!)', async () => {
      const result = await bridge.crawl(baseUrl);

      expect(result.pages).toBeDefined();
      expect(result.pages.length).toBeGreaterThan(0);

      const links = result.pages[0].links;
      expect(links).toBeInstanceOf(Array);

      // This is the CRITICAL test that would have caught the original bug!
      // If crawl4ai returns link objects instead of strings, this will fail
      links.forEach((link: string) => {
        // Links should be strings after Zod validation
        expect(typeof link).toBe('string');

        // Should not be "[object Object]"
        expect(link).not.toBe('[object Object]');
      });
    }, 30000);

    it('validates headless fetch response format', async () => {
      const result = await bridge.fetchHeadless(`${baseUrl}/js-rendered`);

      // Verify response structure
      expect(result.html).toBeDefined();
      expect(typeof result.html).toBe('string');
      expect(result.markdown).toBeDefined();
      expect(typeof result.markdown).toBe('string');
      expect(result.links).toBeInstanceOf(Array);

      // Verify links are either strings or objects with href property
      result.links.forEach((link: string | { href: string }) => {
        if (typeof link === 'object') {
          expect(link).toHaveProperty('href');
          expect(typeof link.href).toBe('string');
        } else {
          expect(typeof link).toBe('string');
        }
      });
    }, 60000); // Headless mode takes longer

    it('extracts markdown content correctly', async () => {
      const result = await bridge.crawl(`${baseUrl}/page2`);

      expect(result.pages[0].content).toContain('Page 2');
      expect(result.pages[0].content).toContain('This is page 2');
    }, 30000);
  });

  describe('Response Validation', () => {
    it('handles timeout correctly with real process', async () => {
      // Test timeout mechanism with very short timeout
      await expect(
        bridge.crawl(baseUrl, 1) // 1ms timeout
      ).rejects.toThrow('timeout');
    }, 30000);

    it('validates response has required fields', async () => {
      const result = await bridge.crawl(`${baseUrl}/leaf`);

      // Zod validation ensures these exist
      expect(result).toHaveProperty('pages');
      expect(result.pages[0]).toHaveProperty('url');
      expect(result.pages[0]).toHaveProperty('title');
      expect(result.pages[0]).toHaveProperty('content');
      expect(result.pages[0]).toHaveProperty('links');
      expect(result.pages[0]).toHaveProperty('crawledAt');
    }, 30000);
  });

  describe('Error Handling', () => {
    it('handles invalid URLs gracefully', async () => {
      // Python worker should handle invalid URLs and return error
      await expect(
        bridge.crawl('not-a-valid-url')
      ).rejects.toThrow();
    }, 30000);

    it('handles 404 pages', async () => {
      // Should not throw, but might return empty or error
      const result = await bridge.crawl(`${baseUrl}/nonexistent`);

      // Should complete with response
      expect(result.pages).toBeDefined();
    }, 30000);
  });

  describe('Content Variations', () => {
    it('handles pages with multiple links', async () => {
      const result = await bridge.crawl(`${baseUrl}/many-links`);

      expect(result.pages[0].links.length).toBeGreaterThan(5);
    }, 30000);

    it('handles pages with no links', async () => {
      const result = await bridge.crawl(`${baseUrl}/leaf`);

      expect(result.pages[0].links).toBeDefined();
      expect(result.pages[0].links).toBeInstanceOf(Array);
      // May be empty or contain base URL
    }, 30000);

    it('handles special characters in content', async () => {
      const result = await bridge.crawl(`${baseUrl}/special-chars`);

      // Content should be properly decoded
      expect(result.pages[0].content).toBeDefined();
      expect(result.pages[0].title).toContain('Special');
    }, 30000);
  });
});
