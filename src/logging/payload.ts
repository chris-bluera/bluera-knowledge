/**
 * Large payload handling utilities for logging
 *
 * Handles large content (raw HTML, MCP responses) by:
 * - Truncating to preview in log entries
 * - Optionally dumping full content to separate files at trace level
 */

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getLogDirectory, isLevelEnabled } from './logger.js';

/** Maximum characters for log preview */
const MAX_PREVIEW_LENGTH = 500;

/** Minimum size to trigger payload dump (10KB) */
const PAYLOAD_DUMP_THRESHOLD = 10_000;

/** Summary of a large payload for logging */
export interface PayloadSummary {
  /** Truncated preview of content */
  preview: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Short hash for identification */
  hash: string;
  /** Filename if full content was dumped (trace level only) */
  payloadFile?: string;
}

/** Get the payload dump directory */
function getPayloadDir(): string {
  const dir = join(getLogDirectory(), 'payload');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Generate a safe filename from an identifier */
function safeFilename(identifier: string): string {
  return identifier.replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 50);
}

/**
 * Summarize a large payload for logging
 *
 * Creates a summary with:
 * - Truncated preview (first 500 chars)
 * - Size in bytes
 * - Short MD5 hash for identification
 * - Optional full dump to file at trace level
 *
 * @param content - The full content to summarize
 * @param type - Type identifier (e.g., 'raw-html', 'mcp-response')
 * @param identifier - Unique identifier (e.g., URL, query)
 * @param dumpFull - Whether to dump full content to file (default: trace level check)
 * @returns PayloadSummary for inclusion in log entry
 *
 * @example
 * logger.info({
 *   url,
 *   ...summarizePayload(html, 'raw-html', url),
 * }, 'Fetched HTML');
 */
export function summarizePayload(
  content: string,
  type: string,
  identifier: string,
  dumpFull: boolean = isLevelEnabled('trace')
): PayloadSummary {
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  const hash = createHash('md5').update(content).digest('hex').substring(0, 12);
  const preview = truncateForLog(content, MAX_PREVIEW_LENGTH);

  const baseSummary = { preview, sizeBytes, hash };

  // Dump full payload to file if enabled and above threshold
  if (dumpFull && sizeBytes > PAYLOAD_DUMP_THRESHOLD) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeId = safeFilename(identifier);
    const filename = `${timestamp}-${type}-${safeId}-${hash}.json`;
    const filepath = join(getPayloadDir(), filename);

    writeFileSync(
      filepath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          type,
          identifier,
          sizeBytes,
          content,
        },
        null,
        2
      )
    );

    return { ...baseSummary, payloadFile: filename };
  }

  return baseSummary;
}

/**
 * Truncate content for logging with ellipsis indicator
 *
 * @param content - Content to truncate
 * @param maxLength - Maximum length (default: 500)
 * @returns Truncated string with '... [truncated]' if needed
 */
export function truncateForLog(content: string, maxLength: number = MAX_PREVIEW_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.substring(0, maxLength)}... [truncated]`;
}
