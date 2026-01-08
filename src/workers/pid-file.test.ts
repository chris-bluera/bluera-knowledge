import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, chmodSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writePidFile, deletePidFile, buildPidFilePath } from './pid-file.js';

/**
 * PID File Operations Tests
 *
 * SAFETY: All tests use fake PID 999999999 - never real PIDs.
 * This prevents accidentally killing VSCode, terminals, or other processes.
 */
describe('PID File Operations', () => {
  let tempDir: string;
  let pidFile: string;

  // Fake PID - guaranteed not to be a real process
  const FAKE_PID = 999999999;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'pid-file-test-'));
    pidFile = join(tempDir, 'test_job.pid');
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      // Restore permissions before cleanup (in case test made it read-only)
      try {
        chmodSync(tempDir, 0o755);
      } catch {
        // Ignore - might not exist
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('writePidFile', () => {
    it('should write PID to file successfully', () => {
      writePidFile(pidFile, FAKE_PID);

      expect(existsSync(pidFile)).toBe(true);
      const content = readFileSync(pidFile, 'utf-8');
      expect(content).toBe('999999999');
    });

    it('should overwrite existing PID file', () => {
      writeFileSync(pidFile, '123456', 'utf-8');

      writePidFile(pidFile, FAKE_PID);

      const content = readFileSync(pidFile, 'utf-8');
      expect(content).toBe('999999999');
    });

    it('should throw with CRITICAL message when write fails (permission denied)', () => {
      // Make directory read-only to prevent file creation
      chmodSync(tempDir, 0o444);

      expect(() => writePidFile(pidFile, FAKE_PID)).toThrow(/CRITICAL/);
      expect(() => writePidFile(pidFile, FAKE_PID)).toThrow(/Failed to write PID file/);
      expect(() => writePidFile(pidFile, FAKE_PID)).toThrow(/Job cannot be cancelled/);
    });

    it('should include file path in error message', () => {
      chmodSync(tempDir, 0o444);

      try {
        writePidFile(pidFile, FAKE_PID);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(pidFile);
      }
    });

    it('should throw when path directory does not exist', () => {
      const invalidPath = '/nonexistent/directory/test.pid';

      expect(() => writePidFile(invalidPath, FAKE_PID)).toThrow(/CRITICAL/);
    });
  });

  describe('deletePidFile', () => {
    it('should delete PID file successfully', () => {
      writeFileSync(pidFile, FAKE_PID.toString(), 'utf-8');

      const result = deletePidFile(pidFile, 'success');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(existsSync(pidFile)).toBe(false);
    });

    it('should return success when PID file does not exist', () => {
      // File doesn't exist
      expect(existsSync(pidFile)).toBe(false);

      const result = deletePidFile(pidFile, 'success');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return failure (NOT throw) when delete fails', () => {
      writeFileSync(pidFile, FAKE_PID.toString(), 'utf-8');
      // Make directory read-only to prevent deletion
      chmodSync(tempDir, 0o444);

      // Should NOT throw
      const result = deletePidFile(pidFile, 'success');

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });

    it('should never throw on delete failure - returns result instead', () => {
      writeFileSync(pidFile, FAKE_PID.toString(), 'utf-8');
      chmodSync(tempDir, 0o444);

      // Must not throw - this is best-effort cleanup
      expect(() => deletePidFile(pidFile, 'failure')).not.toThrow();
      expect(() => deletePidFile(pidFile, 'sigterm')).not.toThrow();
      expect(() => deletePidFile(pidFile, 'success')).not.toThrow();
    });

    it('should handle sigterm context', () => {
      writeFileSync(pidFile, FAKE_PID.toString(), 'utf-8');

      const result = deletePidFile(pidFile, 'sigterm');

      expect(result.success).toBe(true);
      expect(existsSync(pidFile)).toBe(false);
    });

    it('should handle failure context', () => {
      writeFileSync(pidFile, FAKE_PID.toString(), 'utf-8');

      const result = deletePidFile(pidFile, 'failure');

      expect(result.success).toBe(true);
      expect(existsSync(pidFile)).toBe(false);
    });
  });

  describe('buildPidFilePath', () => {
    it('should build correct PID file path', () => {
      const result = buildPidFilePath('/data/jobs', 'job_123');

      expect(result).toBe('/data/jobs/job_123.pid');
    });

    it('should handle job IDs with various formats', () => {
      expect(buildPidFilePath('/jobs', 'abc123def')).toBe('/jobs/abc123def.pid');
      expect(buildPidFilePath('/jobs', 'test-job')).toBe('/jobs/test-job.pid');
      expect(buildPidFilePath('/jobs', 'job_with_underscore')).toBe(
        '/jobs/job_with_underscore.pid'
      );
    });

    it('should handle paths with trailing slash', () => {
      // path.join normalizes this
      const result = buildPidFilePath('/data/jobs/', 'job_123');

      expect(result).toBe('/data/jobs/job_123.pid');
    });
  });
});
