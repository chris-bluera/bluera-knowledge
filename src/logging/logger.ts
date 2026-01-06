/**
 * Core logger factory using pino with file-based rolling logs
 *
 * Features:
 * - File-only output (no console pollution for Claude Code)
 * - Size-based rotation (10MB, keeps 5 files)
 * - LOG_LEVEL env var control (trace/debug/info/warn/error/fatal)
 * - Child loggers per module for context
 */

import pino, { type Logger, type LoggerOptions } from 'pino';
import { homedir } from 'node:os';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Valid log levels */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const VALID_LEVELS: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const VALID_LEVELS_SET: ReadonlySet<string> = new Set(VALID_LEVELS);

/** Default log directory under user home */
function getLogDir(): string {
  return join(homedir(), '.bluera', 'bluera-knowledge', 'logs');
}

/** Resolve and create log directory - fails fast if cannot create */
function ensureLogDir(): string {
  const logDir = getLogDir();
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

/** Check if a string is a valid log level */
function isValidLogLevel(level: string): level is LogLevel {
  return VALID_LEVELS_SET.has(level);
}

/** Get log level from environment - fails fast on invalid value */
function getLogLevel(): LogLevel {
  const level = process.env['LOG_LEVEL']?.toLowerCase();

  if (level === undefined || level === '') {
    return 'info';
  }

  if (!isValidLogLevel(level)) {
    throw new Error(
      `Invalid LOG_LEVEL: "${level}". Valid values: ${VALID_LEVELS.join(', ')}`
    );
  }

  return level;
}

/** Root logger instance - lazily initialized */
let rootLogger: Logger | null = null;

/** Initialize the root logger with pino-roll transport */
function initializeLogger(): Logger {
  if (rootLogger !== null) {
    return rootLogger;
  }

  const logDir = ensureLogDir();
  const logFile = join(logDir, 'app.log');
  const level = getLogLevel();

  const options: LoggerOptions = {
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    transport: {
      target: 'pino-roll',
      options: {
        file: logFile,
        size: '10m', // 10MB rotation
        limit: { count: 5 }, // Keep 5 rotated files
        mkdir: true,
      },
    },
  };

  rootLogger = pino(options);
  return rootLogger;
}

/**
 * Create a named child logger for a specific module
 *
 * @param module - Module name (e.g., 'crawler', 'mcp-server', 'search-service')
 * @returns Logger instance with module context
 *
 * @example
 * const logger = createLogger('crawler');
 * logger.info({ url }, 'Fetching page');
 */
export function createLogger(module: string): Logger {
  const root = initializeLogger();
  return root.child({ module });
}

/**
 * Get the current log level
 */
export function getCurrentLogLevel(): LogLevel {
  return getLogLevel();
}

/**
 * Check if a specific log level is enabled
 */
export function isLevelEnabled(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  const currentIndex = VALID_LEVELS.indexOf(currentLevel);
  const checkIndex = VALID_LEVELS.indexOf(level);
  return checkIndex >= currentIndex;
}

/**
 * Get the log directory path
 */
export function getLogDirectory(): string {
  return getLogDir();
}

/**
 * Flush and shutdown the logger - call before process exit
 */
export function shutdownLogger(): Promise<void> {
  return new Promise((resolve) => {
    if (rootLogger !== null) {
      rootLogger.flush();
      // Give time for async transport to flush
      setTimeout(() => {
        rootLogger = null;
        resolve();
      }, 100);
    } else {
      resolve();
    }
  });
}
