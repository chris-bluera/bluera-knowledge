import { z } from 'zod';

// Schema for crawl4ai link objects (matches CrawledLink interface)
// This validates the actual runtime structure from Python
export const CrawledLinkSchema = z.object({
  href: z.string(),
  text: z.string(),
  title: z.string().optional(),
  base_domain: z.string().optional(),
  head_data: z.unknown().optional(),
  head_extraction_status: z.unknown().optional(),
  head_extraction_error: z.unknown().optional(),
  intrinsic_score: z.number().optional(),
  contextual_score: z.unknown().optional(),
  total_score: z.unknown().optional(),
});

// Schema for individual crawl page result
const CrawlPageSchema = z.object({
  url: z.string(),
  title: z.string(),
  content: z.string(),
  links: z.array(z.string()),
  crawledAt: z.string(),
});

// Schema for full crawl response
export const CrawlResultSchema = z.object({
  pages: z.array(CrawlPageSchema),
});

// Schema for headless fetch response
// Supports both link objects and plain strings
export const HeadlessResultSchema = z.object({
  html: z.string(),
  markdown: z.string(),
  links: z.array(z.union([CrawledLinkSchema, z.string()])),
});

// Type exports derived from schemas (single source of truth)
export type CrawlResult = z.infer<typeof CrawlResultSchema>;
export type HeadlessResult = z.infer<typeof HeadlessResultSchema>;
export type CrawledLink = z.infer<typeof CrawledLinkSchema>;

/**
 * Validates a headless fetch response from Python bridge.
 * Throws ZodError if the response doesn't match the expected schema.
 *
 * @param data - Raw data from Python bridge
 * @returns Validated HeadlessResult
 * @throws {z.ZodError} If validation fails
 */
export function validateHeadlessResult(data: unknown): HeadlessResult {
  return HeadlessResultSchema.parse(data);
}

/**
 * Validates a crawl response from Python bridge.
 * Throws ZodError if the response doesn't match the expected schema.
 *
 * @param data - Raw data from Python bridge
 * @returns Validated CrawlResult
 * @throws {z.ZodError} If validation fails
 */
export function validateCrawlResult(data: unknown): CrawlResult {
  return CrawlResultSchema.parse(data);
}
