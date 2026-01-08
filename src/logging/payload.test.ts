import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock logger module before importing payload
vi.mock('./logger.js', () => ({
  getLogDirectory: vi.fn(),
  isLevelEnabled: vi.fn(),
}));

import { summarizePayload, truncateForLog } from './payload.js';
import { getLogDirectory, isLevelEnabled } from './logger.js';

const mockGetLogDirectory = getLogDirectory as ReturnType<typeof vi.fn>;
const mockIsLevelEnabled = isLevelEnabled as ReturnType<typeof vi.fn>;

describe('payload utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'payload-test-'));
    mockGetLogDirectory.mockReturnValue(tempDir);
    mockIsLevelEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('truncateForLog', () => {
    it('returns content unchanged when under max length', () => {
      const content = 'short content';
      expect(truncateForLog(content, 500)).toBe(content);
    });

    it('truncates content when over max length', () => {
      const content = 'a'.repeat(600);
      const result = truncateForLog(content, 500);
      expect(result.length).toBe(500 + '... [truncated]'.length);
      expect(result).toContain('... [truncated]');
    });

    it('uses default max length of 500', () => {
      const content = 'a'.repeat(600);
      const result = truncateForLog(content);
      expect(result.startsWith('a'.repeat(500))).toBe(true);
      expect(result).toContain('... [truncated]');
    });

    it('handles exact max length content', () => {
      const content = 'a'.repeat(500);
      expect(truncateForLog(content, 500)).toBe(content);
    });
  });

  describe('summarizePayload', () => {
    it('returns summary with preview, size, and hash', () => {
      const content = 'test content for summarization';
      const result = summarizePayload(content, 'test-type', 'test-id');

      expect(result.preview).toBe(content);
      expect(result.sizeBytes).toBe(Buffer.byteLength(content, 'utf8'));
      expect(result.hash).toMatch(/^[a-f0-9]{12}$/);
      expect(result.payloadFile).toBeUndefined();
    });

    it('truncates preview for large content', () => {
      const content = 'x'.repeat(1000);
      const result = summarizePayload(content, 'large', 'large-id');

      expect(result.preview).toContain('... [truncated]');
      expect(result.preview.length).toBeLessThan(content.length);
    });

    it('does not dump payload when dumpFull is false', () => {
      const content = 'x'.repeat(20000); // Above threshold
      const result = summarizePayload(content, 'type', 'id', false);

      expect(result.payloadFile).toBeUndefined();
      const payloadDir = join(tempDir, 'payload');
      expect(existsSync(payloadDir)).toBe(false);
    });

    it('dumps payload to file when dumpFull is true and above threshold', () => {
      const content = 'x'.repeat(20000); // Above 10KB threshold
      const result = summarizePayload(content, 'dump-type', 'dump-id', true);

      expect(result.payloadFile).toBeDefined();
      expect(result.payloadFile).toContain('dump-type');
      expect(result.payloadFile).toContain(result.hash);

      const payloadDir = join(tempDir, 'payload');
      expect(existsSync(payloadDir)).toBe(true);

      const files = readdirSync(payloadDir);
      expect(files.length).toBe(1);
      expect(files[0]).toBe(result.payloadFile);

      const fileContent = JSON.parse(readFileSync(join(payloadDir, files[0]), 'utf8'));
      expect(fileContent.type).toBe('dump-type');
      expect(fileContent.identifier).toBe('dump-id');
      expect(fileContent.content).toBe(content);
      expect(fileContent.sizeBytes).toBe(result.sizeBytes);
    });

    it('does not dump payload below threshold even with dumpFull true', () => {
      const content = 'small content'; // Below 10KB threshold
      const result = summarizePayload(content, 'small-type', 'small-id', true);

      expect(result.payloadFile).toBeUndefined();
    });

    it('creates payload directory if it does not exist', () => {
      const content = 'y'.repeat(20000);
      const payloadDir = join(tempDir, 'payload');
      expect(existsSync(payloadDir)).toBe(false);

      summarizePayload(content, 'create-dir', 'create-id', true);

      expect(existsSync(payloadDir)).toBe(true);
    });

    it('sanitizes identifier for filename', () => {
      const content = 'z'.repeat(20000);
      const result = summarizePayload(content, 'type', 'https://example.com/path?query=1', true);

      expect(result.payloadFile).toBeDefined();
      expect(result.payloadFile).not.toContain('://');
      expect(result.payloadFile).not.toContain('?');
    });

    it('uses trace level check for dumpFull default', () => {
      mockIsLevelEnabled.mockReturnValue(true);
      const content = 'a'.repeat(20000);

      const result = summarizePayload(content, 'trace-type', 'trace-id');

      expect(mockIsLevelEnabled).toHaveBeenCalledWith('trace');
      expect(result.payloadFile).toBeDefined();
    });

    it('generates consistent hash for same content', () => {
      const content = 'consistent content';
      const result1 = summarizePayload(content, 'type1', 'id1');
      const result2 = summarizePayload(content, 'type2', 'id2');

      expect(result1.hash).toBe(result2.hash);
    });
  });
});
