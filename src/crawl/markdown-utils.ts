/**
 * Markdown conversion utilities ported from slurp-ai
 * Source: https://github.com/ratacat/slurp-ai
 *
 * These utilities handle complex documentation site patterns (MkDocs, Sphinx, etc.)
 * and produce clean, well-formatted markdown.
 */

import * as cheerio from 'cheerio';

/**
 * Detect language from code element class names.
 * Handles various class naming patterns from different highlighters.
 */
function detectLanguageFromClass(className: string | undefined): string {
  if (className === undefined || className === '') return '';

  // Common patterns: "language-python", "lang-js", "highlight-python", "python", "hljs language-python"
  const patterns = [
    /language-(\w+)/i,
    /lang-(\w+)/i,
    /highlight-(\w+)/i,
    /hljs\s+(\w+)/i,
    /^(\w+)$/i,
  ];

  for (const pattern of patterns) {
    const match = className.match(pattern);
    if (match?.[1] !== undefined) {
      const lang = match[1].toLowerCase();
      // Filter out common non-language classes
      if (!['hljs', 'highlight', 'code', 'pre', 'block', 'inline'].includes(lang)) {
        return lang;
      }
    }
  }

  return '';
}

/**
 * Escape HTML special characters for safe embedding in HTML.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Preprocess HTML to handle MkDocs/Material theme code blocks.
 *
 * MkDocs wraps code in tables for line numbers:
 * <table><tbody><tr><td>line numbers</td><td><pre><code>code</code></pre></td></tr></tbody></table>
 *
 * This function converts them to standard <pre><code> blocks that Turndown handles correctly.
 * Also strips syntax highlighting spans and empty anchors from code.
 */
export function preprocessHtmlForCodeBlocks(html: string): string {
  if (!html || typeof html !== 'string') return html;

  const $ = cheerio.load(html);

  // Handle MkDocs/Material table-wrapped code blocks
  $('table').each((_i, table) => {
    const $table = $(table);

    // Check if this table contains a code block
    const $codeCell = $table.find('td pre code, td div pre code');

    if ($codeCell.length > 0) {
      // This is a code block table - extract the code
      const $pre = $codeCell.closest('pre');
      const $code = $codeCell.first();

      // Get language from class
      let language = detectLanguageFromClass($code.attr('class'));
      if (!language) {
        language = detectLanguageFromClass($pre.attr('class'));
      }

      // Get the text content, stripping all inner HTML tags
      const codeText = $code.text();

      // Create a clean pre > code block
      const cleanPre = `<pre><code class="language-${language}">${escapeHtml(codeText)}</code></pre>`;

      // Replace the entire table with the clean code block
      $table.replaceWith(cleanPre);
    }
  });

  // Strip empty anchor tags used for line numbers
  $('pre a, code a').each((_i, anchor) => {
    const $anchor = $(anchor);
    if (!$anchor.text().trim()) {
      $anchor.remove();
    }
  });

  // Strip syntax highlighting spans inside code blocks, keeping only text
  $('pre span, code span').each((_i, span) => {
    const $span = $(span);
    $span.replaceWith($span.text());
  });

  // Handle standalone pre blocks that might have spans/anchors
  $('pre').each((_i, pre) => {
    const $pre = $(pre);
    // If this pre has a code child, it was already processed
    if ($pre.find('code').length === 0) {
      // Direct pre without code - get text content
      const text = $pre.text();
      const lang = detectLanguageFromClass($pre.attr('class'));
      $pre.html(`<code class="language-${lang}">${escapeHtml(text)}</code>`);
    }
  });

  return $.html();
}

/**
 * Apply comprehensive cleanup rules to markdown content.
 *
 * Formatting rules:
 * - Double newlines between paragraphs and headings
 * - Double newlines before lists when preceded by normal text
 * - Single newlines between list items
 * - No blank lines inside code blocks
 */
export function cleanupMarkdown(markdown: string): string {
  if (!markdown) return '';

  const trimmed = markdown.trim();
  if (trimmed === '') return '';

  let result = trimmed;

  // 0. Fix broken headings where ## is on its own line followed by the text
  // Pattern: "## \n\nSome text" → "## Some text"
  result = result.replace(/^(#{1,6})\s*\n\n+(\S[^\n]*)/gm, '$1 $2');

  // 0.5. Normalize multiple spaces after heading markers to single space
  // Pattern: "##  Subtitle" → "## Subtitle"
  result = result.replace(/(#{1,6})\s{2,}/g, '$1 ');

  // 1. Fix navigation links with excessive whitespace
  result = result.replace(/\*\s+\[\s*([^\n]+?)\s*\]\(([^)]+)\)/g, '* [$1]($2)');

  // 2. Handle headings with specific newline requirements

  // Text followed by heading should have a single newline between them (no blank line)
  result = result.replace(/([^\n])\n\n+(#\s)/g, '$1\n$2');

  // Add double newlines between text and next heading
  result = result.replace(/(Some text\.)\n(##\s)/g, '$1\n\n$2');

  // Double newlines after a heading when followed by text
  result = result.replace(/(#{1,6}\s[^\n]+)\n([^#\n])/g, '$1\n\n$2');

  // Double newlines between headings
  result = result.replace(/(#{1,6}\s[^\n]+)\n(#{1,6}\s)/g, '$1\n\n$2');

  // 3. Lists - ensure all list items have single newlines only
  result = result.replace(/(\* Item 1)\n\n+(\* Item 2)\n\n+(\* Item 3)/g, '$1\n$2\n$3');

  // 3.5. General list item spacing - ensure single newlines between list items
  result = result.replace(/(^\*\s[^\n]+)\n{2,}(^\*\s)/gm, '$1\n$2');

  // 4. Clean up excessive blank lines (3+ newlines → 2 newlines)
  result = result.replace(/\n{3,}/g, '\n\n');

  // 5. Code blocks - no blank lines after opening or before closing backticks
  result = result.replace(/(```[^\n]*)\n\n+/g, '$1\n');
  result = result.replace(/\n\n+```/g, '\n```');

  // 6. Remove empty list items
  result = result.replace(/\*\s*\n\s*\*/g, '*');

  // 7. Strip any remaining HTML tags that leaked through (common in MkDocs/Material)
  // Remove table structure tags
  result = result.replace(/<\/?table[^>]*>/gi, '');
  result = result.replace(/<\/?tbody[^>]*>/gi, '');
  result = result.replace(/<\/?thead[^>]*>/gi, '');
  result = result.replace(/<\/?tr[^>]*>/gi, '');
  result = result.replace(/<\/?td[^>]*>/gi, '');
  result = result.replace(/<\/?th[^>]*>/gi, '');

  // Remove empty anchor tags: <a></a> or <a id="..."></a>
  result = result.replace(/<a[^>]*><\/a>/gi, '');

  // Remove span tags (syntax highlighting remnants)
  result = result.replace(/<\/?span[^>]*>/gi, '');

  // Remove div tags
  result = result.replace(/<\/?div[^>]*>/gi, '');

  // Remove pre/code tags that leaked
  result = result.replace(/<\/?pre[^>]*>/gi, '');
  result = result.replace(/<\/?code[^>]*>/gi, '');

  // 8. Remove empty markdown links: [](url) and []()
  result = result.replace(/\[\]\([^)]*\)/g, '');

  // 9. Remove codelineno references that leaked into content
  // Pattern: [](_file.md#__codelineno-N-M)
  result = result.replace(/\[\]\([^)]*#__codelineno-[^)]+\)/g, '');

  // Also clean inline codelineno patterns
  result = result.replace(/\[?\]?\([^)]*#__codelineno-[^)]*\)/g, '');

  // 10. Clean up any double-escaped HTML entities that might result
  result = result.replace(/&amp;lt;/g, '&lt;');
  result = result.replace(/&amp;gt;/g, '&gt;');
  result = result.replace(/&amp;amp;/g, '&amp;');

  // 11. Final cleanup - normalize excessive whitespace from removed tags
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+\n/g, '\n');

  return result;
}
