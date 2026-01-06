/**
 * Article converter using @extractus/article-extractor and Turndown
 * Produces clean markdown from HTML using slurp-ai techniques
 */

import { extractFromHtml } from '@extractus/article-extractor';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { preprocessHtmlForCodeBlocks, cleanupMarkdown } from './markdown-utils.js';
import { createLogger, truncateForLog } from '../logging/index.js';

const logger = createLogger('article-converter');

export interface ConversionResult {
  markdown: string;
  title?: string;
  success: boolean;
  error?: string;
}

/**
 * Convert HTML to clean markdown using best practices from slurp-ai
 *
 * Pipeline:
 * 1. Extract main article content (strips navigation, ads, boilerplate)
 * 2. Preprocess HTML (handle MkDocs code blocks)
 * 3. Convert to markdown with Turndown + GFM
 * 4. Cleanup markdown (regex patterns)
 */
export async function convertHtmlToMarkdown(
  html: string,
  url: string,
): Promise<ConversionResult> {
  logger.debug({ url, htmlLength: html.length }, 'Starting HTML conversion');

  try {
    // Step 1: Extract main article content
    let articleHtml: string;
    let title: string | undefined;

    try {
      const article = await extractFromHtml(html, url);
      if (article !== null && article.content !== undefined && article.content !== '') {
        articleHtml = article.content;
        title = article.title !== undefined && article.title !== '' ? article.title : undefined;
        logger.debug({
          url,
          title,
          extractedLength: articleHtml.length,
          usedFullHtml: false,
        }, 'Article content extracted');
      } else {
        // Fallback to full HTML if extraction fails
        articleHtml = html;
        logger.debug({ url, usedFullHtml: true }, 'Article extraction returned empty, using full HTML');
      }
    } catch (extractError) {
      // Fallback to full HTML if extraction fails
      articleHtml = html;
      logger.debug({
        url,
        usedFullHtml: true,
        error: extractError instanceof Error ? extractError.message : String(extractError),
      }, 'Article extraction failed, using full HTML');
    }

    // Step 2: Preprocess HTML for code blocks
    const preprocessed = preprocessHtmlForCodeBlocks(articleHtml);

    // Step 3: Configure Turndown with custom rules
    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use # style headings
      codeBlockStyle: 'fenced', // Use ``` style code blocks
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    });

    // Add GitHub Flavored Markdown support (tables, strikethrough, task lists)
    turndownService.use(gfm);

    // Custom rule for headings with anchors (from slurp-ai)
    turndownService.addRule('headingsWithAnchors', {
      filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
      replacement(content: string, node: HTMLElement): string {
        const level = Number(node.nodeName.charAt(1));
        const hashes = '#'.repeat(level);
        const cleanContent = content
          .replace(/\[\]\([^)]*\)/g, '') // Remove empty links
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        return cleanContent !== '' ? `\n\n${hashes} ${cleanContent}\n\n` : '';
      },
    });

    // Convert to markdown
    const rawMarkdown = turndownService.turndown(preprocessed);

    // Step 4: Cleanup markdown with comprehensive regex patterns
    const markdown = cleanupMarkdown(rawMarkdown);

    logger.debug({
      url,
      title,
      rawMarkdownLength: rawMarkdown.length,
      finalMarkdownLength: markdown.length,
    }, 'HTML to markdown conversion complete');

    // Log markdown preview at trace level
    logger.trace({
      url,
      markdownPreview: truncateForLog(markdown, 1000),
    }, 'Markdown content preview');

    return {
      markdown,
      ...(title !== undefined && { title }),
      success: true,
    };
  } catch (error) {
    logger.error({
      url,
      error: error instanceof Error ? error.message : String(error),
    }, 'HTML to markdown conversion failed');

    return {
      markdown: '',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
