/**
 * Claude CLI client for intelligent crawling and extraction
 * Uses `claude -p` programmatically to analyze page structure and extract content
 */

import { spawn, execSync } from 'node:child_process';

/**
 * Schema for crawl strategy response from Claude
 */
export interface CrawlStrategy {
  urls: string[];
  reasoning: string;
}

const CRAWL_STRATEGY_SCHEMA = {
  type: 'object',
  properties: {
    urls: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of URLs to crawl based on the instruction',
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of why these URLs were selected',
    },
  },
  required: ['urls', 'reasoning'],
};

/**
 * Client for interacting with Claude Code CLI
 */
export class ClaudeClient {
  private readonly timeout: number;
  private static availabilityChecked = false;
  private static available = false;

  /**
   * Check if Claude CLI is available in PATH
   * Result is cached after first check for performance
   */
  static isAvailable(): boolean {
    if (!ClaudeClient.availabilityChecked) {
      try {
        execSync('which claude', { stdio: 'ignore' });
        ClaudeClient.available = true;
      } catch {
        ClaudeClient.available = false;
      }
      ClaudeClient.availabilityChecked = true;
    }
    return ClaudeClient.available;
  }

  /**
   * Reset availability cache (for testing)
   */
  static resetAvailabilityCache(): void {
    ClaudeClient.availabilityChecked = false;
    ClaudeClient.available = false;
  }

  constructor(options: { timeout?: number } = {}) {
    this.timeout = options.timeout ?? 30000; // 30s default
  }

  /**
   * Determine which URLs to crawl based on natural language instruction
   *
   * @param seedHtml - HTML content of the seed page
   * @param instruction - Natural language crawl instruction (e.g., "scrape all Getting Started pages")
   * @returns List of URLs to crawl with reasoning
   */
  async determineCrawlUrls(
    seedHtml: string,
    instruction: string,
  ): Promise<CrawlStrategy> {
    const prompt = `You are analyzing a webpage to determine which pages to crawl based on the user's instruction.

Instruction: ${instruction}

Webpage HTML (analyze the navigation structure, links, and content):
${this.truncateHtml(seedHtml, 50000)}

Based on the instruction, extract and return a list of absolute URLs that should be crawled. Look for navigation menus, sidebars, headers, and link structures that match the instruction.

Return only URLs that are relevant to the instruction. If the instruction mentions specific sections (e.g., "Getting Started"), find links in those sections.`;

    try {
      const result = await this.callClaude(prompt, CRAWL_STRATEGY_SCHEMA);
      const parsed: unknown = JSON.parse(result);

      // Validate and narrow type
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('urls' in parsed) ||
        !('reasoning' in parsed) ||
        !Array.isArray(parsed.urls) ||
        parsed.urls.length === 0 ||
        typeof parsed.reasoning !== 'string' ||
        !parsed.urls.every((url) => typeof url === 'string')
      ) {
        throw new Error('Claude returned invalid crawl strategy');
      }

      // Type is now properly narrowed - urls is string[] after validation
      return { urls: parsed.urls, reasoning: parsed.reasoning };
    } catch (error) {
      throw new Error(
        `Failed to determine crawl strategy: ${error instanceof Error ? error.message : String(error)}`,
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
  async extractContent(markdown: string, instruction: string): Promise<string> {
    const prompt = `${instruction}

Content to analyze:
${this.truncateMarkdown(markdown, 100000)}`;

    try {
      const result = await this.callClaude(prompt);
      return result.trim();
    } catch (error) {
      throw new Error(
        `Failed to extract content: ${error instanceof Error ? error.message : String(error)}`,
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
  private async callClaude(
    prompt: string,
    jsonSchema?: Record<string, unknown>,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const args = ['-p'];

      // Add JSON schema if provided
      if (jsonSchema) {
        args.push('--json-schema', JSON.stringify(jsonSchema));
        args.push('--output-format', 'json');
      }

      const proc = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout | undefined;

      // Set timeout
      if (this.timeout > 0) {
        timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          reject(new Error(`Claude CLI timed out after ${String(this.timeout)}ms`));
        }, this.timeout);
      }

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number | null) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }

        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(
            new Error(
              `Claude CLI exited with code ${String(code)}${stderr ? `: ${stderr}` : ''}`,
            ),
          );
        }
      });

      proc.on('error', (err) => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });

      // Write prompt to stdin
      proc.stdin.write(prompt);
      proc.stdin.end();
    });
  }

  /**
   * Truncate HTML to a maximum length (keep important parts)
   */
  private truncateHtml(html: string, maxLength: number): string {
    if (html.length <= maxLength) return html;

    // Try to keep the beginning (usually has navigation)
    return html.substring(0, maxLength) + '\n\n[... HTML truncated ...]';
  }

  /**
   * Truncate markdown to a maximum length
   */
  private truncateMarkdown(markdown: string, maxLength: number): string {
    if (markdown.length <= maxLength) return markdown;

    return markdown.substring(0, maxLength) + '\n\n[... content truncated ...]';
  }
}
