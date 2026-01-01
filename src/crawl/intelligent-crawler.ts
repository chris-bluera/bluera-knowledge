/**
 * Intelligent web crawler with natural language control
 * Two modes: Intelligent (Claude-driven) and Simple (BFS)
 */

import { EventEmitter } from 'node:events';
import axios from 'axios';
import { ClaudeClient, type CrawlStrategy } from './claude-client.js';
import { convertHtmlToMarkdown } from './article-converter.js';
import { PythonBridge, type CrawledLink } from './bridge.js';

export interface CrawlOptions {
  crawlInstruction?: string; // Natural language: what to crawl
  extractInstruction?: string; // Natural language: what to extract
  maxPages?: number; // Max pages to crawl (default: 50)
  timeout?: number; // Per-page timeout in ms (default: 30000)
  simple?: boolean; // Force simple BFS mode
  useHeadless?: boolean; // Enable headless browser for JavaScript-rendered sites
}

export interface CrawlResult {
  url: string;
  title?: string;
  markdown: string;
  extracted?: string;
  depth?: number;
}

export interface CrawlProgress {
  type: 'start' | 'strategy' | 'page' | 'extraction' | 'complete' | 'error';
  pagesVisited: number;
  totalPages: number;
  currentUrl?: string;
  message?: string;
  error?: Error;
}

/**
 * Intelligent crawler that uses Claude CLI for strategy and extraction
 */
export class IntelligentCrawler extends EventEmitter {
  private readonly claudeClient: ClaudeClient;
  private readonly pythonBridge: PythonBridge;
  private readonly visited: Set<string>;
  private stopped: boolean;

  constructor() {
    super();
    this.claudeClient = new ClaudeClient();
    this.pythonBridge = new PythonBridge();
    this.visited = new Set();
    this.stopped = false;
  }

  /**
   * Crawl a website with intelligent or simple mode
   */
  async *crawl(
    seedUrl: string,
    options: CrawlOptions = {},
  ): AsyncIterable<CrawlResult> {
    const {
      crawlInstruction,
      extractInstruction,
      maxPages = 50,
      simple = false,
    } = options;

    this.visited.clear();
    this.stopped = false;

    const startProgress: CrawlProgress = {
      type: 'start',
      pagesVisited: 0,
      totalPages: maxPages,
    };
    this.emit('progress', startProgress);

    // Determine mode: intelligent (with crawl instruction) or simple (BFS)
    const useIntelligentMode = !simple && crawlInstruction !== undefined && crawlInstruction !== '';

    if (useIntelligentMode) {
      // TypeScript knows crawlInstruction is defined here due to useIntelligentMode check
      yield* this.crawlIntelligent(seedUrl, crawlInstruction, extractInstruction, maxPages, options.useHeadless ?? false);
    } else {
      yield* this.crawlSimple(seedUrl, extractInstruction, maxPages, options.useHeadless ?? false);
    }

    const completeProgress: CrawlProgress = {
      type: 'complete',
      pagesVisited: this.visited.size,
      totalPages: this.visited.size,
    };
    this.emit('progress', completeProgress);
  }

  /**
   * Intelligent mode: Use Claude to determine which URLs to crawl
   */
  private async *crawlIntelligent(
    seedUrl: string,
    crawlInstruction: string,
    extractInstruction: string | undefined,
    maxPages: number,
    useHeadless: boolean = false,
  ): AsyncIterable<CrawlResult> {
    let strategy: CrawlStrategy;

    try {
      // Step 1: Fetch seed page HTML
      const strategyStartProgress: CrawlProgress = {
        type: 'strategy',
        pagesVisited: 0,
        totalPages: maxPages,
        currentUrl: seedUrl,
        message: 'Analyzing page structure with Claude...',
      };
      this.emit('progress', strategyStartProgress);

      const seedHtml = await this.fetchHtml(seedUrl, useHeadless);

      // Step 2: Ask Claude which URLs to crawl
      strategy = await this.claudeClient.determineCrawlUrls(seedHtml, crawlInstruction);

      const strategyCompleteProgress: CrawlProgress = {
        type: 'strategy',
        pagesVisited: 0,
        totalPages: maxPages,
        message: `Claude identified ${String(strategy.urls.length)} URLs to crawl: ${strategy.reasoning}`,
      };
      this.emit('progress', strategyCompleteProgress);
    } catch (error) {
      // Fallback to simple mode if Claude fails
      const errorProgress: CrawlProgress = {
        type: 'error',
        pagesVisited: 0,
        totalPages: maxPages,
        message: 'Claude crawl strategy failed, falling back to simple mode',
        error: error instanceof Error ? error : new Error(String(error)),
      };
      this.emit('progress', errorProgress);

      yield* this.crawlSimple(seedUrl, extractInstruction, maxPages);
      return;
    }

    // Step 3: Crawl each URL from Claude's strategy
    let pagesVisited = 0;

    for (const url of strategy.urls) {
      if (this.stopped || pagesVisited >= maxPages) break;
      if (this.visited.has(url)) continue;

      try {
        const result = await this.crawlSinglePage(url, extractInstruction, pagesVisited, useHeadless);
        pagesVisited++;
        yield result;
      } catch (error) {
        const pageErrorProgress: CrawlProgress = {
          type: 'error',
          pagesVisited,
          totalPages: maxPages,
          currentUrl: url,
          error: error instanceof Error ? error : new Error(String(error)),
        };
        this.emit('progress', pageErrorProgress);
      }
    }
  }

  /**
   * Simple mode: BFS crawling with depth limit
   */
  private async *crawlSimple(
    seedUrl: string,
    extractInstruction: string | undefined,
    maxPages: number,
    useHeadless: boolean = false,
  ): AsyncIterable<CrawlResult> {
    const queue: Array<{ url: string; depth: number }> = [{ url: seedUrl, depth: 0 }];
    const maxDepth = 2; // Default depth limit for simple mode
    let pagesVisited = 0;

    while (queue.length > 0 && pagesVisited < maxPages && !this.stopped) {
      const current = queue.shift();

      if (!current || this.visited.has(current.url) || current.depth > maxDepth) {
        continue;
      }

      try {
        const result = await this.crawlSinglePage(
          current.url,
          extractInstruction,
          pagesVisited,
          useHeadless,
        );
        result.depth = current.depth;
        pagesVisited++;

        yield result;

        // Add links to queue if we haven't reached max depth
        if (current.depth < maxDepth) {
          try {
            const links = await this.extractLinks(current.url, useHeadless);

            if (links.length === 0) {
              console.warn(`No links found on ${current.url} - page may be a leaf node`);
            } else {
              console.log(`Found ${String(links.length)} links on ${current.url}`);
            }

            for (const link of links) {
              if (!this.visited.has(link) && this.isSameDomain(seedUrl, link)) {
                queue.push({ url: link, depth: current.depth + 1 });
              }
            }
          } catch (error) {
            // Log link extraction failure but continue crawling other pages
            const errorProgress: CrawlProgress = {
              type: 'error',
              pagesVisited,
              totalPages: maxPages,
              currentUrl: current.url,
              message: `Failed to extract links from ${current.url}`,
              error: error instanceof Error ? error : new Error(String(error)),
            };
            this.emit('progress', errorProgress);
          }
        }
      } catch (error) {
        const simpleErrorProgress: CrawlProgress = {
          type: 'error',
          pagesVisited,
          totalPages: maxPages,
          currentUrl: current.url,
          error: error instanceof Error ? error : new Error(String(error)),
        };
        this.emit('progress', simpleErrorProgress);
      }
    }
  }

  /**
   * Crawl a single page: fetch, convert to markdown, optionally extract
   */
  private async crawlSinglePage(
    url: string,
    extractInstruction: string | undefined,
    pagesVisited: number,
    useHeadless: boolean = false,
  ): Promise<CrawlResult> {
    const pageProgress: CrawlProgress = {
      type: 'page',
      pagesVisited,
      totalPages: 0,
      currentUrl: url,
    };
    this.emit('progress', pageProgress);

    // Mark as visited
    this.visited.add(url);

    // Fetch HTML
    const html = await this.fetchHtml(url, useHeadless);

    // Convert to clean markdown using slurp-ai techniques
    const conversion = await convertHtmlToMarkdown(html, url);

    if (!conversion.success) {
      throw new Error(`Failed to convert HTML: ${conversion.error ?? 'Unknown error'}`);
    }

    let extracted: string | undefined;

    // Optional: Extract specific information using Claude
    if (extractInstruction !== undefined && extractInstruction !== '') {
      try {
        const extractionProgress: CrawlProgress = {
          type: 'extraction',
          pagesVisited,
          totalPages: 0,
          currentUrl: url,
        };
        this.emit('progress', extractionProgress);

        extracted = await this.claudeClient.extractContent(
          conversion.markdown,
          extractInstruction,
        );
      } catch (error) {
        // If extraction fails, just store raw markdown
        const extractionErrorProgress: CrawlProgress = {
          type: 'error',
          pagesVisited,
          totalPages: 0,
          currentUrl: url,
          message: 'Extraction failed, storing raw markdown',
          error: error instanceof Error ? error : new Error(String(error)),
        };
        this.emit('progress', extractionErrorProgress);
      }
    }

    return {
      url,
      ...(conversion.title !== undefined && { title: conversion.title }),
      markdown: conversion.markdown,
      ...(extracted !== undefined && { extracted }),
    };
  }

  /**
   * Fetch HTML content from a URL
   */
  private async fetchHtml(url: string, useHeadless: boolean = false): Promise<string> {
    if (useHeadless) {
      try {
        const result = await this.pythonBridge.fetchHeadless(url);
        return result.html;
      } catch (error) {
        // Fallback to axios if headless fails
        console.warn(`Headless fetch failed for ${url}, falling back to axios:`, error);
      }
    }

    // Original axios implementation for static sites
    try {
      const response = await axios.get<string>(url, {
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; bluera-knowledge-crawler/1.0)',
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Extract links from a page using Python bridge
   */
  private async extractLinks(url: string, useHeadless: boolean = false): Promise<string[]> {
    try {
      // Use headless mode for link extraction if enabled
      if (useHeadless) {
        const result = await this.pythonBridge.fetchHeadless(url);
        // Extract href strings from link objects (crawl4ai returns objects, not strings)
        return result.links.map((link: CrawledLink | string) => {
          if (typeof link === 'string') return link;
          return link.href;
        });
      }

      const result = await this.pythonBridge.crawl(url);

      // Validate response structure (handle potential runtime type mismatches)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- TypeScript types claim pages exists but Python bridge may return invalid structure at runtime
      const firstPage = result.pages?.[0];
      if (!firstPage) {
        throw new Error(`Invalid crawl response structure for ${url}: missing pages array`);
      }

      return firstPage.links;
    } catch (error: unknown) {
      // Log the error for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to extract links from ${url}:`, errorMessage);

      // Re-throw the error instead of silently swallowing it
      throw new Error(`Link extraction failed for ${url}: ${errorMessage}`);
    }
  }

  /**
   * Check if two URLs are from the same domain
   */
  private isSameDomain(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname.toLowerCase();
      const domain2 = new URL(url2).hostname.toLowerCase();
      return domain1 === domain2 || domain1.endsWith(`.${domain2}`) || domain2.endsWith(`.${domain1}`);
    } catch {
      return false;
    }
  }

  /**
   * Stop the crawler
   */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.pythonBridge.stop();
  }
}
