/**
 * Logging module - pino-based file logging with auto-rotation
 *
 * @example
 * import { createLogger, summarizePayload } from './logging/index.js';
 *
 * const logger = createLogger('my-module');
 * logger.info({ data }, 'Something happened');
 *
 * // For large payloads:
 * logger.info({
 *   ...summarizePayload(html, 'raw-html', url),
 * }, 'Fetched HTML');
 */

export {
  createLogger,
  shutdownLogger,
  getCurrentLogLevel,
  isLevelEnabled,
  getLogDirectory,
  type LogLevel,
} from './logger.js';

export {
  summarizePayload,
  truncateForLog,
  type PayloadSummary,
} from './payload.js';
