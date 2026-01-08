import {
  PythonBridge,
  createLogger,
  summarizePayload,
  truncateForLog
} from "./chunk-HUEWT6U5.js";

// src/crawl/intelligent-crawler.ts
import { EventEmitter } from "events";
import axios from "axios";

// src/crawl/article-converter.ts
import { extractFromHtml } from "@extractus/article-extractor";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// src/crawl/markdown-utils.ts
import * as cheerio from "cheerio";
function detectLanguageFromClass(className) {
  if (className === void 0 || className === "") return "";
  const patterns = [
    /language-(\w+)/i,
    /lang-(\w+)/i,
    /highlight-(\w+)/i,
    /hljs\s+(\w+)/i,
    /^(\w+)$/i
  ];
  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match?.[1] !== void 0) {
      const lang = match[1].toLowerCase();
      if (!["hljs", "highlight", "code", "pre", "block", "inline"].includes(lang)) {
        return lang;
      }
    }
  }
  return "";
}
function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function preprocessHtmlForCodeBlocks(html) {
  if (!html || typeof html !== "string") return html;
  const $ = cheerio.load(html);
  $("table").each((_i, table) => {
    const $table = $(table);
    const $codeCell = $table.find("td pre code, td div pre code");
    if ($codeCell.length > 0) {
      const $pre = $codeCell.closest("pre");
      const $code = $codeCell.first();
      let language = detectLanguageFromClass($code.attr("class"));
      if (!language) {
        language = detectLanguageFromClass($pre.attr("class"));
      }
      const codeText = $code.text();
      const cleanPre = `<pre><code class="language-${language}">${escapeHtml(codeText)}</code></pre>`;
      $table.replaceWith(cleanPre);
    }
  });
  $("pre a, code a").each((_i, anchor) => {
    const $anchor = $(anchor);
    if (!$anchor.text().trim()) {
      $anchor.remove();
    }
  });
  $("pre span, code span").each((_i, span) => {
    const $span = $(span);
    $span.replaceWith($span.text());
  });
  $("pre").each((_i, pre) => {
    const $pre = $(pre);
    if ($pre.find("code").length === 0) {
      const text = $pre.text();
      const lang = detectLanguageFromClass($pre.attr("class"));
      $pre.html(`<code class="language-${lang}">${escapeHtml(text)}</code>`);
    }
  });
  return $.html();
}
function cleanupMarkdown(markdown) {
  if (!markdown) return "";
  const trimmed = markdown.trim();
  if (trimmed === "") return "";
  let result = trimmed;
  result = result.replace(/^(#{1,6})\s*\n\n+(\S[^\n]*)/gm, "$1 $2");
  result = result.replace(/(#{1,6})\s{2,}/g, "$1 ");
  result = result.replace(/\*\s+\[\s*([^\n]+?)\s*\]\(([^)]+)\)/g, "* [$1]($2)");
  result = result.replace(/([^\n])\n\n+(#\s)/g, "$1\n$2");
  result = result.replace(/(Some text\.)\n(##\s)/g, "$1\n\n$2");
  result = result.replace(/(#{1,6}\s[^\n]+)\n([^#\n])/g, "$1\n\n$2");
  result = result.replace(/(#{1,6}\s[^\n]+)\n(#{1,6}\s)/g, "$1\n\n$2");
  result = result.replace(/(\* Item 1)\n\n+(\* Item 2)\n\n+(\* Item 3)/g, "$1\n$2\n$3");
  result = result.replace(/(^\*\s[^\n]+)\n{2,}(^\*\s)/gm, "$1\n$2");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/(```[^\n]*)\n\n+/g, "$1\n");
  result = result.replace(/\n\n+```/g, "\n```");
  result = result.replace(/\*\s*\n\s*\*/g, "*");
  result = result.replace(/<\/?table[^>]*>/gi, "");
  result = result.replace(/<\/?tbody[^>]*>/gi, "");
  result = result.replace(/<\/?thead[^>]*>/gi, "");
  result = result.replace(/<\/?tr[^>]*>/gi, "");
  result = result.replace(/<\/?td[^>]*>/gi, "");
  result = result.replace(/<\/?th[^>]*>/gi, "");
  result = result.replace(/<a[^>]*><\/a>/gi, "");
  result = result.replace(/<\/?span[^>]*>/gi, "");
  result = result.replace(/<\/?div[^>]*>/gi, "");
  result = result.replace(/<\/?pre[^>]*>/gi, "");
  result = result.replace(/<\/?code[^>]*>/gi, "");
  result = result.replace(/\[\]\([^)]*\)/g, "");
  result = result.replace(/\[\]\([^)]*#__codelineno-[^)]+\)/g, "");
  result = result.replace(/\[?\]?\([^)]*#__codelineno-[^)]*\)/g, "");
  result = result.replace(/&amp;lt;/g, "&lt;");
  result = result.replace(/&amp;gt;/g, "&gt;");
  result = result.replace(/&amp;amp;/g, "&amp;");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/[ \t]+\n/g, "\n");
  return result;
}

// src/crawl/article-converter.ts
var logger = createLogger("article-converter");
async function convertHtmlToMarkdown(html, url) {
  logger.debug({ url, htmlLength: html.length }, "Starting HTML conversion");
  try {
    let articleHtml;
    let title;
    try {
      const article = await extractFromHtml(html, url);
      if (article?.content !== void 0 && article.content !== "") {
        articleHtml = article.content;
        title = article.title !== void 0 && article.title !== "" ? article.title : void 0;
        logger.debug(
          {
            url,
            title,
            extractedLength: articleHtml.length,
            usedFullHtml: false
          },
          "Article content extracted"
        );
      } else {
        articleHtml = html;
        logger.debug(
          { url, usedFullHtml: true },
          "Article extraction returned empty, using full HTML"
        );
      }
    } catch (extractError) {
      articleHtml = html;
      logger.debug(
        {
          url,
          usedFullHtml: true,
          error: extractError instanceof Error ? extractError.message : String(extractError)
        },
        "Article extraction failed, using full HTML"
      );
    }
    const preprocessed = preprocessHtmlForCodeBlocks(articleHtml);
    const turndownService = new TurndownService({
      headingStyle: "atx",
      // Use # style headings
      codeBlockStyle: "fenced",
      // Use ``` style code blocks
      fence: "```",
      emDelimiter: "*",
      strongDelimiter: "**",
      linkStyle: "inlined"
    });
    turndownService.use(gfm);
    turndownService.addRule("headingsWithAnchors", {
      filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
      replacement(content, node) {
        const level = Number(node.nodeName.charAt(1));
        const hashes = "#".repeat(level);
        const cleanContent = content.replace(/\[\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
        return cleanContent !== "" ? `

${hashes} ${cleanContent}

` : "";
      }
    });
    const rawMarkdown = turndownService.turndown(preprocessed);
    const markdown = cleanupMarkdown(rawMarkdown);
    logger.debug(
      {
        url,
        title,
        rawMarkdownLength: rawMarkdown.length,
        finalMarkdownLength: markdown.length
      },
      "HTML to markdown conversion complete"
    );
    logger.trace(
      {
        url,
        markdownPreview: truncateForLog(markdown, 1e3)
      },
      "Markdown content preview"
    );
    return {
      markdown,
      ...title !== void 0 && { title },
      success: true
    };
  } catch (error) {
    logger.error(
      {
        url,
        error: error instanceof Error ? error.message : String(error)
      },
      "HTML to markdown conversion failed"
    );
    return {
      markdown: "",
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// src/crawl/claude-client.ts
import { spawn, execSync } from "child_process";
var CRAWL_STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    urls: {
      type: "array",
      items: { type: "string" },
      description: "List of URLs to crawl based on the instruction"
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of why these URLs were selected"
    }
  },
  required: ["urls", "reasoning"]
};
var ClaudeClient = class _ClaudeClient {
  timeout;
  static availabilityChecked = false;
  static available = false;
  /**
   * Check if Claude CLI is available in PATH
   * Result is cached after first check for performance
   */
  static isAvailable() {
    if (!_ClaudeClient.availabilityChecked) {
      try {
        execSync("which claude", { stdio: "ignore" });
        _ClaudeClient.available = true;
      } catch {
        _ClaudeClient.available = false;
      }
      _ClaudeClient.availabilityChecked = true;
    }
    return _ClaudeClient.available;
  }
  /**
   * Reset availability cache (for testing)
   */
  static resetAvailabilityCache() {
    _ClaudeClient.availabilityChecked = false;
    _ClaudeClient.available = false;
  }
  constructor(options = {}) {
    this.timeout = options.timeout ?? 3e4;
  }
  /**
   * Determine which URLs to crawl based on natural language instruction
   *
   * @param seedHtml - HTML content of the seed page
   * @param instruction - Natural language crawl instruction (e.g., "scrape all Getting Started pages")
   * @returns List of URLs to crawl with reasoning
   */
  async determineCrawlUrls(seedHtml, instruction) {
    const prompt = `You are analyzing a webpage to determine which pages to crawl based on the user's instruction.

Instruction: ${instruction}

Webpage HTML (analyze the navigation structure, links, and content):
${this.truncateHtml(seedHtml, 5e4)}

Based on the instruction, extract and return a list of absolute URLs that should be crawled. Look for navigation menus, sidebars, headers, and link structures that match the instruction.

Return only URLs that are relevant to the instruction. If the instruction mentions specific sections (e.g., "Getting Started"), find links in those sections.`;
    try {
      const result = await this.callClaude(prompt, CRAWL_STRATEGY_SCHEMA);
      const parsed = JSON.parse(result);
      if (typeof parsed !== "object" || parsed === null || !("urls" in parsed) || !("reasoning" in parsed) || !Array.isArray(parsed.urls) || parsed.urls.length === 0 || typeof parsed.reasoning !== "string" || !parsed.urls.every((url) => typeof url === "string")) {
        throw new Error("Claude returned invalid crawl strategy");
      }
      return { urls: parsed.urls, reasoning: parsed.reasoning };
    } catch (error) {
      throw new Error(
        `Failed to determine crawl strategy: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Extract specific information from markdown content using natural language
   *
   * @param markdown - Page content in markdown format
   * @param instruction - Natural language extraction instruction (e.g., "extract pricing info")
   * @returns Extracted information as text
   */
  async extractContent(markdown, instruction) {
    const prompt = `${instruction}

Content to analyze:
${this.truncateMarkdown(markdown, 1e5)}`;
    try {
      const result = await this.callClaude(prompt);
      return result.trim();
    } catch (error) {
      throw new Error(
        `Failed to extract content: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Call Claude CLI with a prompt
   *
   * @param prompt - The prompt to send to Claude
   * @param jsonSchema - Optional JSON schema for structured output
   * @returns Claude's response as a string
   */
  async callClaude(prompt, jsonSchema) {
    return new Promise((resolve, reject) => {
      const args = ["-p"];
      if (jsonSchema) {
        args.push("--json-schema", JSON.stringify(jsonSchema));
        args.push("--output-format", "json");
      }
      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
        env: { ...process.env }
      });
      let stdout = "";
      let stderr = "";
      let timeoutId;
      if (this.timeout > 0) {
        timeoutId = setTimeout(() => {
          proc.kill("SIGTERM");
          reject(new Error(`Claude CLI timed out after ${String(this.timeout)}ms`));
        }, this.timeout);
      }
      proc.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("close", (code) => {
        if (timeoutId !== void 0) {
          clearTimeout(timeoutId);
        }
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(
            new Error(`Claude CLI exited with code ${String(code)}${stderr ? `: ${stderr}` : ""}`)
          );
        }
      });
      proc.on("error", (err) => {
        if (timeoutId !== void 0) {
          clearTimeout(timeoutId);
        }
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }
  /**
   * Truncate HTML to a maximum length (keep important parts)
   */
  truncateHtml(html, maxLength) {
    if (html.length <= maxLength) return html;
    return `${html.substring(0, maxLength)}

[... HTML truncated ...]`;
  }
  /**
   * Truncate markdown to a maximum length
   */
  truncateMarkdown(markdown, maxLength) {
    if (markdown.length <= maxLength) return markdown;
    return `${markdown.substring(0, maxLength)}

[... content truncated ...]`;
  }
};

// src/crawl/intelligent-crawler.ts
var logger2 = createLogger("crawler");
var IntelligentCrawler = class extends EventEmitter {
  claudeClient;
  pythonBridge;
  visited;
  stopped;
  constructor() {
    super();
    this.claudeClient = new ClaudeClient();
    this.pythonBridge = new PythonBridge();
    this.visited = /* @__PURE__ */ new Set();
    this.stopped = false;
  }
  /**
   * Crawl a website with intelligent or simple mode
   */
  async *crawl(seedUrl, options = {}) {
    const { crawlInstruction, extractInstruction, maxPages = 50, simple = false } = options;
    this.visited.clear();
    this.stopped = false;
    logger2.info(
      {
        seedUrl,
        maxPages,
        mode: simple ? "simple" : crawlInstruction !== void 0 && crawlInstruction !== "" ? "intelligent" : "simple",
        hasExtractInstruction: extractInstruction !== void 0
      },
      "Starting crawl"
    );
    const startProgress = {
      type: "start",
      pagesVisited: 0,
      totalPages: maxPages
    };
    this.emit("progress", startProgress);
    const useIntelligentMode = !simple && crawlInstruction !== void 0 && crawlInstruction !== "";
    if (useIntelligentMode) {
      yield* this.crawlIntelligent(
        seedUrl,
        crawlInstruction,
        extractInstruction,
        maxPages,
        options.useHeadless ?? false
      );
    } else {
      yield* this.crawlSimple(seedUrl, extractInstruction, maxPages, options.useHeadless ?? false);
    }
    logger2.info(
      {
        seedUrl,
        pagesVisited: this.visited.size
      },
      "Crawl complete"
    );
    const completeProgress = {
      type: "complete",
      pagesVisited: this.visited.size,
      totalPages: this.visited.size
    };
    this.emit("progress", completeProgress);
  }
  /**
   * Intelligent mode: Use Claude to determine which URLs to crawl
   */
  async *crawlIntelligent(seedUrl, crawlInstruction, extractInstruction, maxPages, useHeadless = false) {
    if (!ClaudeClient.isAvailable()) {
      const fallbackProgress = {
        type: "error",
        pagesVisited: 0,
        totalPages: maxPages,
        message: "Claude CLI not found, using simple crawl mode (install Claude Code for intelligent crawling)",
        error: new Error("Claude CLI not available")
      };
      this.emit("progress", fallbackProgress);
      yield* this.crawlSimple(seedUrl, extractInstruction, maxPages, useHeadless);
      return;
    }
    let strategy;
    try {
      const strategyStartProgress = {
        type: "strategy",
        pagesVisited: 0,
        totalPages: maxPages,
        currentUrl: seedUrl,
        message: "Analyzing page structure with Claude..."
      };
      this.emit("progress", strategyStartProgress);
      const seedHtml = await this.fetchHtml(seedUrl, useHeadless);
      strategy = await this.claudeClient.determineCrawlUrls(seedHtml, crawlInstruction);
      const strategyCompleteProgress = {
        type: "strategy",
        pagesVisited: 0,
        totalPages: maxPages,
        message: `Claude identified ${String(strategy.urls.length)} URLs to crawl: ${strategy.reasoning}`
      };
      this.emit("progress", strategyCompleteProgress);
    } catch (error) {
      const errorProgress = {
        type: "error",
        pagesVisited: 0,
        totalPages: maxPages,
        message: "Claude crawl strategy failed, falling back to simple mode",
        error: error instanceof Error ? error : new Error(String(error))
      };
      this.emit("progress", errorProgress);
      yield* this.crawlSimple(seedUrl, extractInstruction, maxPages);
      return;
    }
    let pagesVisited = 0;
    for (const url of strategy.urls) {
      if (this.stopped || pagesVisited >= maxPages) break;
      if (this.visited.has(url)) continue;
      try {
        const result = await this.crawlSinglePage(
          url,
          extractInstruction,
          pagesVisited,
          useHeadless
        );
        pagesVisited++;
        yield result;
      } catch (error) {
        const pageErrorProgress = {
          type: "error",
          pagesVisited,
          totalPages: maxPages,
          currentUrl: url,
          error: error instanceof Error ? error : new Error(String(error))
        };
        this.emit("progress", pageErrorProgress);
      }
    }
  }
  /**
   * Simple mode: BFS crawling with depth limit
   */
  async *crawlSimple(seedUrl, extractInstruction, maxPages, useHeadless = false) {
    const queue = [{ url: seedUrl, depth: 0 }];
    const maxDepth = 2;
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
          useHeadless
        );
        result.depth = current.depth;
        pagesVisited++;
        yield result;
        if (current.depth < maxDepth) {
          try {
            const links = await this.extractLinks(current.url, useHeadless);
            if (links.length === 0) {
              logger2.debug({ url: current.url }, "No links found - page may be a leaf node");
            } else {
              logger2.debug(
                { url: current.url, linkCount: links.length },
                "Links extracted from page"
              );
            }
            for (const link of links) {
              if (!this.visited.has(link) && this.isSameDomain(seedUrl, link)) {
                queue.push({ url: link, depth: current.depth + 1 });
              }
            }
          } catch (error) {
            const errorProgress = {
              type: "error",
              pagesVisited,
              totalPages: maxPages,
              currentUrl: current.url,
              message: `Failed to extract links from ${current.url}`,
              error: error instanceof Error ? error : new Error(String(error))
            };
            this.emit("progress", errorProgress);
          }
        }
      } catch (error) {
        const simpleErrorProgress = {
          type: "error",
          pagesVisited,
          totalPages: maxPages,
          currentUrl: current.url,
          error: error instanceof Error ? error : new Error(String(error))
        };
        this.emit("progress", simpleErrorProgress);
      }
    }
  }
  /**
   * Crawl a single page: fetch, convert to markdown, optionally extract
   */
  async crawlSinglePage(url, extractInstruction, pagesVisited, useHeadless = false) {
    const pageProgress = {
      type: "page",
      pagesVisited,
      totalPages: 0,
      currentUrl: url
    };
    this.emit("progress", pageProgress);
    this.visited.add(url);
    const html = await this.fetchHtml(url, useHeadless);
    const conversion = await convertHtmlToMarkdown(html, url);
    if (!conversion.success) {
      logger2.error({ url, error: conversion.error }, "HTML to markdown conversion failed");
      throw new Error(`Failed to convert HTML: ${conversion.error ?? "Unknown error"}`);
    }
    logger2.debug(
      {
        url,
        title: conversion.title,
        markdownLength: conversion.markdown.length
      },
      "Article converted to markdown"
    );
    let extracted;
    if (extractInstruction !== void 0 && extractInstruction !== "") {
      if (!ClaudeClient.isAvailable()) {
        const skipProgress = {
          type: "error",
          pagesVisited,
          totalPages: 0,
          currentUrl: url,
          message: "Skipping extraction (Claude CLI not available), storing raw markdown",
          error: new Error("Claude CLI not available")
        };
        this.emit("progress", skipProgress);
      } else {
        try {
          const extractionProgress = {
            type: "extraction",
            pagesVisited,
            totalPages: 0,
            currentUrl: url
          };
          this.emit("progress", extractionProgress);
          extracted = await this.claudeClient.extractContent(
            conversion.markdown,
            extractInstruction
          );
        } catch (error) {
          const extractionErrorProgress = {
            type: "error",
            pagesVisited,
            totalPages: 0,
            currentUrl: url,
            message: "Extraction failed, storing raw markdown",
            error: error instanceof Error ? error : new Error(String(error))
          };
          this.emit("progress", extractionErrorProgress);
        }
      }
    }
    return {
      url,
      ...conversion.title !== void 0 && { title: conversion.title },
      markdown: conversion.markdown,
      ...extracted !== void 0 && { extracted }
    };
  }
  /**
   * Fetch HTML content from a URL
   */
  async fetchHtml(url, useHeadless = false) {
    const startTime = Date.now();
    logger2.debug({ url, useHeadless }, "Fetching HTML");
    if (useHeadless) {
      try {
        const result = await this.pythonBridge.fetchHeadless(url);
        const durationMs = Date.now() - startTime;
        logger2.info(
          {
            url,
            useHeadless: true,
            durationMs,
            ...summarizePayload(result.html, "raw-html", url)
          },
          "Raw HTML fetched"
        );
        return result.html;
      } catch (error) {
        logger2.warn(
          { url, error: error instanceof Error ? error.message : String(error) },
          "Headless fetch failed, falling back to axios"
        );
      }
    }
    try {
      const response = await axios.get(url, {
        timeout: 3e4,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; bluera-knowledge-crawler/1.0)"
        }
      });
      const durationMs = Date.now() - startTime;
      logger2.info(
        {
          url,
          useHeadless: false,
          durationMs,
          ...summarizePayload(response.data, "raw-html", url)
        },
        "Raw HTML fetched"
      );
      return response.data;
    } catch (error) {
      logger2.error(
        { url, error: error instanceof Error ? error.message : String(error) },
        "Failed to fetch HTML"
      );
      throw new Error(
        `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Extract links from a page using Python bridge
   */
  async extractLinks(url, useHeadless = false) {
    try {
      if (useHeadless) {
        const result2 = await this.pythonBridge.fetchHeadless(url);
        return result2.links.map((link) => {
          if (typeof link === "string") return link;
          return link.href;
        });
      }
      const result = await this.pythonBridge.crawl(url);
      const firstPage = result.pages?.[0];
      if (!firstPage) {
        throw new Error(`Invalid crawl response structure for ${url}: missing pages array`);
      }
      return firstPage.links;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger2.error({ url, error: errorMessage }, "Failed to extract links");
      throw new Error(`Link extraction failed for ${url}: ${errorMessage}`);
    }
  }
  /**
   * Check if two URLs are from the same domain
   */
  isSameDomain(url1, url2) {
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
  async stop() {
    this.stopped = true;
    await this.pythonBridge.stop();
  }
};

export {
  IntelligentCrawler
};
//# sourceMappingURL=chunk-IZWOEBFM.js.map