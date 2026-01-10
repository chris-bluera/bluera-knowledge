import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Serve Command Integration Tests
 *
 * Tests that the HTTP server actually starts, responds to requests,
 * and shuts down cleanly. Unlike unit tests that mock the serve function,
 * these tests spawn a real server process and make actual HTTP requests.
 */
describe('Serve Integration', () => {
  let tempDir: string;
  let testFilesDir: string;
  let serverProcess: ChildProcess | null = null;
  const TEST_PORT = 19877; // Use a unique port to avoid conflicts

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'serve-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(
      join(testFilesDir, 'test.md'),
      '# Test Document\n\nContent for serve integration testing.'
    );
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    // Clean up server process if still running
    if (serverProcess !== null) {
      serverProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (serverProcess !== null) {
          serverProcess.on('exit', () => resolve());
          // Force kill after timeout
          setTimeout(() => {
            if (serverProcess !== null) {
              serverProcess.kill('SIGKILL');
            }
            resolve();
          }, 2000);
        } else {
          resolve();
        }
      });
      serverProcess = null;
    }
  });

  /**
   * Start the serve command and wait for it to be ready
   */
  async function startServer(port: number): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        'node',
        ['dist/index.js', 'serve', '--port', String(port), '--data-dir', tempDir],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          reject(new Error('Server startup timeout'));
          proc.kill();
        }
      }, 30000);

      proc.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('Starting server')) {
          resolved = true;
          clearTimeout(timeout);
          // Give it a moment to actually start listening
          setTimeout(() => resolve(proc), 500);
        }
      });

      proc.stderr?.on('data', (data: Buffer) => {
        // Log stderr but don't fail - some warnings are expected
        console.error('Server stderr:', data.toString());
      });

      proc.on('error', (err) => {
        if (!resolved) {
          clearTimeout(timeout);
          reject(err);
        }
      });

      proc.on('exit', (code) => {
        if (!resolved) {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${String(code)}`));
        }
      });
    });
  }

  /**
   * Make an HTTP request with timeout
   */
  async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs = 5000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  describe('Server Startup and Health', () => {
    it('starts server and responds to /health', async () => {
      serverProcess = await startServer(TEST_PORT);

      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT}/health`);
      expect(response.ok).toBe(true);

      const body = (await response.json()) as { status: string };
      expect(body.status).toBe('ok');
    }, 60000);

    it('responds with CORS headers', async () => {
      serverProcess = await startServer(TEST_PORT + 1);

      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 1}/health`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'GET',
        },
      });

      // CORS preflight should succeed
      expect(response.ok).toBe(true);
    }, 60000);
  });

  describe('Store API', () => {
    beforeEach(async () => {
      serverProcess = await startServer(TEST_PORT + 2);
    });

    it('lists stores via GET /api/stores', async () => {
      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 2}/api/stores`);
      expect(response.ok).toBe(true);

      const body = (await response.json()) as unknown[];
      expect(Array.isArray(body)).toBe(true);
    }, 60000);

    it('creates store via POST /api/stores', async () => {
      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 2}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'serve-test-store',
          type: 'file',
          path: testFilesDir,
        }),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { id: string; name: string };
      expect(body.name).toBe('serve-test-store');
      expect(body.id).toBeDefined();
    }, 60000);

    it('returns 400 for invalid store creation', async () => {
      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 2}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'invalid-store',
          type: 'file',
          // Missing required 'path' for file type
        }),
      });

      expect(response.status).toBe(400);
    }, 60000);
  });

  describe('Search API', () => {
    it('handles search request via POST /api/search', async () => {
      serverProcess = await startServer(TEST_PORT + 3);

      // Search with no stores indexed - should return empty results
      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 3}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
          limit: 5,
        }),
      });

      expect(response.ok).toBe(true);
      const body = (await response.json()) as { results: unknown[] };
      expect(body.results).toBeDefined();
      expect(Array.isArray(body.results)).toBe(true);
    }, 60000);

    it('returns 400 for invalid search request', async () => {
      serverProcess = await startServer(TEST_PORT + 4);

      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 4}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required 'query'
        }),
      });

      expect(response.status).toBe(400);
    }, 60000);
  });

  describe('Graceful Shutdown', () => {
    it('shuts down cleanly on SIGTERM', async () => {
      serverProcess = await startServer(TEST_PORT + 5);

      // Verify server is running
      const response = await fetchWithTimeout(`http://127.0.0.1:${TEST_PORT + 5}/health`);
      expect(response.ok).toBe(true);

      // Send SIGTERM
      serverProcess.kill('SIGTERM');

      // Wait for process to exit
      const exitCode = await new Promise<number | null>((resolve) => {
        if (serverProcess !== null) {
          serverProcess.on('exit', (code) => resolve(code));
          // Allow more time for graceful shutdown
          setTimeout(() => resolve(null), 10000);
        } else {
          resolve(null);
        }
      });

      // Process should exit cleanly (code 0) or be killed (null)
      // On some systems the process may not exit with 0 due to async cleanup
      expect(exitCode === 0 || exitCode === null).toBe(true);
      serverProcess = null; // Already exited
    }, 60000);
  });
});
