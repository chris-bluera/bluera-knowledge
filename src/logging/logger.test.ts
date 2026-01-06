import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCurrentLogLevel, isLevelEnabled, getLogDirectory } from './logger.js';

describe('logger', () => {
  const originalEnv = process.env['LOG_LEVEL'];

  beforeEach(() => {
    delete process.env['LOG_LEVEL'];
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env['LOG_LEVEL'] = originalEnv;
    } else {
      delete process.env['LOG_LEVEL'];
    }
  });

  describe('getCurrentLogLevel', () => {
    it('returns info as default level', () => {
      expect(getCurrentLogLevel()).toBe('info');
    });

    it('returns level from environment variable', () => {
      process.env['LOG_LEVEL'] = 'debug';
      expect(getCurrentLogLevel()).toBe('debug');
    });

    it('handles lowercase environment variable', () => {
      process.env['LOG_LEVEL'] = 'WARN';
      expect(getCurrentLogLevel()).toBe('warn');
    });

    it('treats empty string as default', () => {
      process.env['LOG_LEVEL'] = '';
      expect(getCurrentLogLevel()).toBe('info');
    });

    it('throws on invalid log level', () => {
      process.env['LOG_LEVEL'] = 'invalid';
      expect(() => getCurrentLogLevel()).toThrow('Invalid LOG_LEVEL: "invalid"');
    });
  });

  describe('isLevelEnabled', () => {
    it('returns true when check level is at or above current level', () => {
      process.env['LOG_LEVEL'] = 'info';
      expect(isLevelEnabled('info')).toBe(true);
      expect(isLevelEnabled('warn')).toBe(true);
      expect(isLevelEnabled('error')).toBe(true);
    });

    it('returns false when check level is below current level', () => {
      process.env['LOG_LEVEL'] = 'warn';
      expect(isLevelEnabled('debug')).toBe(false);
      expect(isLevelEnabled('info')).toBe(false);
    });

    it('enables all levels when set to trace', () => {
      process.env['LOG_LEVEL'] = 'trace';
      expect(isLevelEnabled('trace')).toBe(true);
      expect(isLevelEnabled('debug')).toBe(true);
      expect(isLevelEnabled('info')).toBe(true);
    });
  });

  describe('getLogDirectory', () => {
    it('returns path under home directory', () => {
      const logDir = getLogDirectory();
      expect(logDir).toContain('.bluera');
      expect(logDir).toContain('bluera-knowledge');
      expect(logDir).toContain('logs');
    });
  });
});
