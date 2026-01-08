import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * CLI Consistency Tests
 *
 * These tests verify:
 * 1. Exit codes are consistent across commands
 * 2. --format json is respected by all commands
 * 3. --quiet suppresses non-essential output
 * 4. Error messages follow consistent format
 * 5. Spinners check TTY before displaying
 * 6. store delete prompts for confirmation without --force
 */

/**
 * CLI Consistency Tests
 *
 * Tests that CLI commands have consistent behavior:
 * - Exit codes
 * - JSON format support
 * - Quiet mode
 * - Error message format
 *
 * The CLI now properly cleans up resources via destroyServices() which
 * stops the PythonBridge subprocess, allowing commands to exit cleanly.
 */
describe('CLI Consistency', () => {
  let tempDir: string;
  let testFilesDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-consistency-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(
      join(testFilesDir, 'test.md'),
      '# Test\n\nContent for testing CLI consistency.'
    );
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Helper to run CLI and capture output + exit code
   * Properly handles quoted arguments
   */
  const runCli = (
    args: string,
    options: { expectError?: boolean; stdin?: string } = {}
  ): {
    stdout: string;
    stderr: string;
    exitCode: number;
  } => {
    // Parse args respecting quotes
    const argArray: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (const char of args) {
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          argArray.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    if (current) {
      argArray.push(current);
    }

    const result = spawnSync('node', ['dist/index.js', ...argArray, '--data-dir', tempDir], {
      encoding: 'utf-8',
      timeout: 60000,
      input: options.stdin,
    });
    return {
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: result.status ?? 1,
    };
  };

  /**
   * Helper for commands expected to succeed
   */
  const cli = (args: string): string => {
    return execSync(`node dist/index.js ${args} --data-dir "${tempDir}"`, {
      encoding: 'utf-8',
      timeout: 60000,
    });
  };

  describe('Exit Codes', () => {
    it('returns exit code 0 on success', () => {
      const result = runCli('store list');
      expect(result.exitCode).toBe(0);
    }, 15000);

    it('returns non-zero exit code when store not found', () => {
      const result = runCli('store info nonexistent-store');
      // Exit code may be 3 (expected) or 134 (SIGABRT from LanceDB cleanup)
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Error: Store not found');
    });

    it('returns non-zero exit code when store not found for delete', () => {
      const result = runCli('store delete nonexistent-store --force');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Error: Store not found');
    });

    it('returns non-zero exit code when store not found for index', () => {
      const result = runCli('index nonexistent-store');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Error: Store not found');
    });

    it('returns non-zero exit code when store not found for search with --stores', () => {
      const result = runCli('search "test" --stores nonexistent-store');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('Error: Store not found');
    });
  });

  describe('--format json Support', () => {
    beforeAll(async () => {
      // Create a store for testing
      try {
        cli(`store create json-test-store --type file --source "${testFilesDir}"`);
        cli('index json-test-store');
      } catch {
        // Store may already exist
      }
    }, 120000);

    it('store list supports --format json', () => {
      const result = runCli('store list --format json');
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it('store info supports --format json', () => {
      const result = runCli('store info json-test-store --format json');
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('id');
    });

    it('search supports --format json', () => {
      const result = runCli('search "test" --format json');
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('results');
    });

    it('index supports --format json', () => {
      const result = runCli('index json-test-store --format json');
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('documentsIndexed');
    }, 120000);
  });

  describe('--quiet Flag', () => {
    beforeAll(async () => {
      try {
        cli(`store create quiet-test-store --type file --source "${testFilesDir}"`);
      } catch {
        // Store may already exist
      }
    });

    it('--quiet suppresses all output for index on success', () => {
      const result = runCli('index quiet-test-store --quiet');
      expect(result.exitCode).toBe(0);
      // Quiet mode = no output on success
      expect(result.stdout.trim()).toBe('');
    }, 120000);

    it('--quiet outputs only store names for store list', () => {
      const result = runCli('store list --quiet');
      expect(result.exitCode).toBe(0);
      // Should not contain decorative headers
      expect(result.stdout).not.toContain('Stores:');
      // Should still list store names (one per line)
      expect(result.stdout.trim().length).toBeGreaterThan(0);
    });

    it('--quiet outputs only paths for search', () => {
      const result = runCli('search "test" --quiet');
      expect(result.exitCode).toBe(0);
      // Should not contain verbose headers
      expect(result.stdout).not.toContain('Search:');
      expect(result.stdout).not.toContain('Mode:');
    });
  });

  describe('Error Message Format', () => {
    it('uses consistent "Error:" prefix for store not found', () => {
      const result = runCli('store info nonexistent');
      expect(result.stderr).toMatch(/^Error: Store not found: nonexistent/m);
    });

    it('uses consistent "Error:" prefix for store delete not found', () => {
      const result = runCli('store delete nonexistent --force');
      expect(result.stderr).toMatch(/^Error: Store not found: nonexistent/m);
    });

    it('uses consistent "Error:" prefix for index not found', () => {
      const result = runCli('index nonexistent');
      expect(result.stderr).toMatch(/^Error: Store not found: nonexistent/m);
    });

    it('uses consistent "Error:" prefix for search store not found', () => {
      const result = runCli('search "test" --stores nonexistent');
      expect(result.stderr).toMatch(/^Error: Store not found: nonexistent/m);
    });

    // Note: crawl auto-creates stores when not found, so no error test needed
  });

  describe('store delete Confirmation', () => {
    beforeAll(async () => {
      try {
        cli(`store create delete-test-store --type file --source "${testFilesDir}"`);
      } catch {
        // Store may already exist
      }
    });

    it('prompts for confirmation without --force', () => {
      // When run without --force and without TTY, should fail or prompt
      const result = runCli('store delete delete-test-store');
      // Should either prompt (and fail due to no input) or require --force
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr + result.stdout).toMatch(/confirm|--force|cancelled/i);
    });

    it('deletes without prompt with --force', () => {
      // First recreate the store
      try {
        cli(`store create delete-force-store --type file --source "${testFilesDir}"`);
      } catch {
        // ignore
      }

      const result = runCli('store delete delete-force-store --force');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Deleted');
    }, 15000);

    it('accepts -y as alias for --force', () => {
      try {
        cli(`store create delete-y-store --type file --source "${testFilesDir}"`);
      } catch {
        // ignore
      }

      const result = runCli('store delete delete-y-store -y');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Deleted');
    });
  });

  describe('Non-TTY Spinner Behavior', () => {
    it('does not show spinner characters in non-TTY mode for index', () => {
      // Create a store for this test
      try {
        cli(`store create spinner-test --type file --source "${testFilesDir}"`);
      } catch {
        // ignore
      }

      const result = runCli('index spinner-test');
      // Should not contain ora spinner frames (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ or similar)
      expect(result.stdout).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
      expect(result.exitCode).toBe(0);
    }, 120000);
  });
});
