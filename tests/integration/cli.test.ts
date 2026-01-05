import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * CLI Integration Tests
 *
 * Tests the CLI commands work correctly when run as subprocesses.
 * The CLI now properly cleans up resources via destroyServices() which
 * stops the PythonBridge subprocess, allowing commands to exit cleanly.
 */
describe('CLI Integration', () => {
  let tempDir: string;
  let testFilesDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(
      join(testFilesDir, 'test.md'),
      '# Test Document\n\nThis is content about TypeScript and JavaScript programming.'
    );
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const cli = (args: string): string => {
    return execSync(`node dist/index.js ${args} --data-dir "${tempDir}"`, {
      encoding: 'utf-8',
      timeout: 120000,
    });
  };

  it('shows help', () => {
    const output = cli('--help');
    expect(output).toContain('CLI tool for managing knowledge stores');
    expect(output).toContain('search');
    expect(output).toContain('index');
  });

  it('creates and lists stores', () => {
    cli(`store create test-store --type file --source "${testFilesDir}"`);
    const listOutput = cli('store list');
    expect(listOutput).toContain('test-store');
  });

  it('shows store info', () => {
    const output = cli('store info test-store');
    expect(output).toContain('test-store');
    expect(output).toContain('file');
  });

  it('indexes a store', () => {
    const output = cli('index test-store');
    expect(output).toContain('Indexed');
    expect(output).toContain('documents');
  }, 120000);

  it('searches indexed content', () => {
    const output = cli('search "TypeScript programming"');
    expect(output).toContain('Search:');
    expect(output).toContain('Results:');
  }, 60000);
});
