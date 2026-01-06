/**
 * Token estimation service using Anthropic's recommended heuristic.
 * For Claude 3+ models, Anthropic recommends ~3.5 characters per token
 * for English text. This varies by language.
 *
 * Note: The official @anthropic-ai/tokenizer package only works for
 * pre-Claude 3 models. For accurate counts on Claude 3+, use the
 * Token Count API. This heuristic is suitable for display purposes.
 */

const CHARS_PER_TOKEN = 3.5;

/**
 * Estimate token count for a string using character-based heuristic.
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (rounded up)
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Format token count for display with appropriate suffix.
 * @param tokens - Token count
 * @returns Formatted string like "~1.2k" or "~847"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `~${(tokens / 1000).toFixed(1)}k`;
  }
  return `~${String(tokens)}`;
}
