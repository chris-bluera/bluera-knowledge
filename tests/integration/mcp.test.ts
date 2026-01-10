import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as readline from 'node:readline';

/**
 * MCP Server Integration Tests
 *
 * Tests that the MCP server actually starts and accepts JSON-RPC messages.
 * Unlike unit tests that mock runMCPServer, these tests spawn a real
 * MCP server process and communicate via stdin/stdout.
 */
describe('MCP Integration', () => {
  let tempDir: string;
  let testFilesDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(
      join(testFilesDir, 'test.md'),
      '# Test Document\n\nContent for MCP integration testing.'
    );
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  interface JSONRPCResponse {
    jsonrpc: string;
    id: number;
    result?: unknown;
    error?: { code: number; message: string };
  }

  interface MCPClient {
    proc: ChildProcess;
    sendRequest: (method: string, params?: Record<string, unknown>) => Promise<JSONRPCResponse>;
    close: () => void;
  }

  /**
   * Start the MCP server and return a client with message helpers
   */
  function startMCPServer(): MCPClient {
    const proc = spawn('node', ['dist/mcp/server.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PROJECT_ROOT: tempDir,
        DATA_DIR: join(tempDir, 'data'),
        CONFIG_PATH: join(tempDir, 'config.json'),
      },
    });

    // Set up a single readline interface for the entire process lifetime
    const rl = readline.createInterface({ input: proc.stdout! });
    const pendingRequests = new Map<
      number,
      { resolve: (r: JSONRPCResponse) => void; reject: (e: Error) => void }
    >();
    let requestId = 0;

    rl.on('line', (line: string) => {
      try {
        const response = JSON.parse(line) as JSONRPCResponse;
        const pending = pendingRequests.get(response.id);
        if (pending !== undefined) {
          pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      } catch {
        // Ignore non-JSON lines (like log output)
      }
    });

    return {
      proc,
      sendRequest: (
        method: string,
        params: Record<string, unknown> = {}
      ): Promise<JSONRPCResponse> => {
        return new Promise((resolve, reject) => {
          if (proc.stdin === null) {
            reject(new Error('Process stdin not available'));
            return;
          }

          const id = ++requestId;
          const timeout = setTimeout(() => {
            pendingRequests.delete(id);
            reject(new Error(`Timeout waiting for response to ${method}`));
          }, 30000);

          pendingRequests.set(id, {
            resolve: (r) => {
              clearTimeout(timeout);
              resolve(r);
            },
            reject: (e) => {
              clearTimeout(timeout);
              reject(e);
            },
          });

          const request = JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params,
          });

          proc.stdin.write(request + '\n');
        });
      },
      close: (): void => {
        rl.close();
        proc.kill('SIGTERM');
      },
    };
  }

  /**
   * Wait for process to be ready
   */
  async function waitForReady(client: MCPClient, timeoutMs = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for MCP server to start'));
      }, timeoutMs);

      // MCP servers typically become ready quickly
      // Give it a moment to initialize
      setTimeout(() => {
        clearTimeout(timeout);
        resolve();
      }, 1000);

      client.proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      client.proc.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          reject(new Error(`MCP server exited with code ${code}`));
        }
      });
    });
  }

  let mcpClient: MCPClient | null = null;

  afterEach(async () => {
    // Clean up MCP client if still running
    if (mcpClient !== null) {
      mcpClient.close();
      await new Promise<void>((resolve) => {
        if (mcpClient !== null) {
          mcpClient.proc.on('exit', () => resolve());
          setTimeout(() => {
            if (mcpClient !== null) {
              mcpClient.proc.kill('SIGKILL');
            }
            resolve();
          }, 2000);
        } else {
          resolve();
        }
      });
      mcpClient = null;
    }
  });

  it('starts, lists tools, and handles tool execution', async () => {
    mcpClient = startMCPServer();
    await waitForReady(mcpClient);

    // 1. Initialize
    const initResponse = await mcpClient.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });

    expect(initResponse.jsonrpc).toBe('2.0');
    expect(initResponse.error).toBeUndefined();
    expect(initResponse.result).toBeDefined();

    const initResult = initResponse.result as {
      protocolVersion: string;
      serverInfo: { name: string; version: string };
      capabilities: { tools: Record<string, unknown> };
    };
    expect(initResult.serverInfo.name).toBe('bluera-knowledge');
    expect(initResult.capabilities.tools).toBeDefined();

    // 2. List tools
    const toolsResponse = await mcpClient.sendRequest('tools/list', {});

    expect(toolsResponse.error).toBeUndefined();
    expect(toolsResponse.result).toBeDefined();

    const toolsResult = toolsResponse.result as {
      tools: Array<{ name: string; description: string }>;
    };
    expect(Array.isArray(toolsResult.tools)).toBe(true);

    const toolNames = toolsResult.tools.map((t) => t.name);
    expect(toolNames).toContain('search');
    expect(toolNames).toContain('get_full_context');
    expect(toolNames).toContain('execute');

    // 3. Call search tool
    const searchResponse = await mcpClient.sendRequest('tools/call', {
      name: 'search',
      arguments: {
        query: 'test query',
        limit: 5,
      },
    });

    expect(searchResponse.error).toBeUndefined();
    expect(searchResponse.result).toBeDefined();

    const searchResult = searchResponse.result as {
      content: Array<{ type: string; text: string }>;
    };
    expect(Array.isArray(searchResult.content)).toBe(true);

    // 4. Call execute with help command
    const helpResponse = await mcpClient.sendRequest('tools/call', {
      name: 'execute',
      arguments: {
        command: 'help',
      },
    });

    expect(helpResponse.error).toBeUndefined();
    expect(helpResponse.result).toBeDefined();

    const helpResult = helpResponse.result as { content: Array<{ type: string; text: string }> };
    expect(helpResult.content[0]?.text).toContain('Available commands');
  }, 120000);
});
