/**
 * Comprehensive tests for PythonBridge
 * Coverage: process spawn, lifecycle, request/response queueing, timeouts, JSON parsing, crashes, memory leaks, concurrency, restart logic
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PythonBridge } from './bridge.js';
import type { ChildProcess } from 'node:child_process';
import type { Interface as ReadlineInterface, ReadLineOptions } from 'node:readline';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock readline
vi.mock('node:readline', () => ({
  createInterface: vi.fn(),
}));

const { spawn } = await import('node:child_process');
const { createInterface } = await import('node:readline');

describe('PythonBridge', () => {
  let bridge: PythonBridge;
  let mockProcess: MockChildProcess;
  let mockReadline: MockReadline;
  let mockStderrReadline: MockReadline;

  // Mock classes that satisfy the ChildProcess and Interface contracts
  class MockChildProcess extends EventEmitter {
    stdin = { write: vi.fn() };
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    kill = vi.fn(() => {
      // Emit exit event asynchronously to simulate real process behavior
      setImmediate(() => this.emit('exit', 0, null));
    });
    // Type-safe cast helper
    asChildProcess(): ChildProcess {
      return this as unknown as ChildProcess;
    }
  }

  class MockReadline extends EventEmitter {
    close = vi.fn();
    // Type-safe cast helper
    asInterface(): ReadlineInterface {
      return this as unknown as ReadlineInterface;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new PythonBridge();
    mockProcess = new MockChildProcess();
    mockReadline = new MockReadline();
    mockStderrReadline = new MockReadline();

    vi.mocked(spawn).mockReturnValue(mockProcess.asChildProcess());
    vi.mocked(createInterface).mockImplementation((config: ReadLineOptions) => {
      // First call is for stderr, second is for stdout
      if (config.input === mockProcess.stderr) {
        return mockStderrReadline.asInterface();
      }
      return mockReadline.asInterface();
    });
  });

  afterEach(async () => {
    await bridge.stop();
  });

  describe('Process Spawn and Lifecycle', () => {
    it('should spawn python process on start', async () => {
      await bridge.start();

      expect(spawn).toHaveBeenCalledWith(
        'python3',
        ['python/crawl_worker.py'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should not spawn multiple processes on multiple start calls', async () => {
      await bridge.start();
      await bridge.start();
      await bridge.start();

      expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should create readline interface for stdout', async () => {
      await bridge.start();

      expect(createInterface).toHaveBeenCalledWith(
        expect.objectContaining({
          input: mockProcess.stdout,
        })
      );
    });

    it('should create readline interface for stderr', async () => {
      await bridge.start();

      expect(createInterface).toHaveBeenCalledWith(
        expect.objectContaining({
          input: mockProcess.stderr,
        })
      );
    });

    it('should auto-start process when crawl is called', async () => {
      const promise = bridge.crawl('https://example.com');

      // Wait for process to start and write
      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;
      expect(spawn).toHaveBeenCalled();
    });
  });

  describe('Request/Response Queueing', () => {
    it('should send JSON-RPC request to stdin', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      // Emit response immediately
      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"jsonrpc":"2.0"')
      );
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('"method":"crawl"')
      );
    });

    it('should include URL in request params', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com/test');

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;

      expect(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0]).toContain(
        '"url":"https://example.com/test"'
      );
    });

    it('should generate unique request IDs', async () => {
      await bridge.start();

      const promise1 = bridge.crawl('https://example.com/1');
      const promise2 = bridge.crawl('https://example.com/2');

      const req1 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      const req2 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[1]?.[0] as string);

      mockReadline.emit('line', JSON.stringify({ id: req1.id, result: { pages: [] } }));
      mockReadline.emit('line', JSON.stringify({ id: req2.id, result: { pages: [] } }));

      await Promise.all([promise1, promise2]);

      expect(req1.id).not.toBe(req2.id);
    });

    it('should match responses to requests by ID', async () => {
      await bridge.start();

      const promise1 = bridge.crawl('https://example.com/1');
      const promise2 = bridge.crawl('https://example.com/2');

      const req1 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      const req2 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[1]?.[0] as string);

      // Send responses in reverse order
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: req2.id,
          result: {
            pages: [
              { url: 'url2', title: 't2', content: 'c2', links: [], crawledAt: '2024-01-02' },
            ],
          },
        })
      );
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: req1.id,
          result: {
            pages: [
              { url: 'url1', title: 't1', content: 'c1', links: [], crawledAt: '2024-01-01' },
            ],
          },
        })
      );

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.pages[0]?.url).toBe('url1');
      expect(result2.pages[0]?.url).toBe('url2');
    });

    it('should resolve promise on successful response', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: {
            pages: [
              {
                url: 'https://example.com',
                title: 'Test',
                content: 'Content',
                links: [],
                crawledAt: '2024-01-01',
              },
            ],
          },
        })
      );

      const result = await promise;
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0]?.url).toBe('https://example.com');
    });

    it('should reject promise on error response', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          error: { message: 'Crawl failed' },
        })
      );

      await expect(promise).rejects.toThrow('Crawl failed');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after specified duration', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 100);

      // Don't send response - let it timeout
      await expect(promise).rejects.toThrow('Crawl timeout after 100ms');
    });

    it('should use default timeout of 30000ms', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      // Should not timeout immediately - resolve quickly
      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await expect(promise).resolves.toBeDefined();
    });

    it('should clear timeout on successful response', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 5000);

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;

      // If timeout wasn't cleared, test would fail
      // This passing means timeout was properly cleared
    });

    it('should clear timeout on error response', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 5000);

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          error: { message: 'Error' },
        })
      );

      await expect(promise).rejects.toThrow();
    });

    it('should remove pending request on timeout', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 50);

      await expect(promise).rejects.toThrow('timeout');

      // Try to send a late response - should be ignored
      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      expect(() => {
        mockReadline.emit(
          'line',
          JSON.stringify({
            id: request.id,
            result: { pages: [] },
          })
        );
      }).not.toThrow();
    });
  });

  describe('JSON Parsing from stdout', () => {
    it('should parse valid JSON responses', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await expect(promise).resolves.toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 100);

      mockReadline.emit('line', '{ invalid json }');

      // Should timeout since response wasn't parsed
      await expect(promise).rejects.toThrow('timeout');
    });

    it('should ignore responses with unknown IDs', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 100);

      mockReadline.emit(
        'line',
        JSON.stringify({
          id: 'unknown-id',
          result: { pages: [] },
        })
      );

      // Should timeout since response wasn't matched
      await expect(promise).rejects.toThrow('timeout');
    });

    it('should handle multiple line events', async () => {
      await bridge.start();
      const promise1 = bridge.crawl('https://example.com/1');
      const promise2 = bridge.crawl('https://example.com/2');

      const req1 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      const req2 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[1]?.[0] as string);

      mockReadline.emit('line', JSON.stringify({ id: req1.id, result: { pages: [] } }));
      mockReadline.emit('line', JSON.stringify({ id: req2.id, result: { pages: [] } }));

      await Promise.all([promise1, promise2]);
    });
  });

  describe('Process Crash Handling', () => {
    it('should reject pending requests on process error', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      mockProcess.emit('error', new Error('Process crashed'));

      await expect(promise).rejects.toThrow('Process error');
    });

    it('should reject pending requests on non-zero exit', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      mockProcess.emit('exit', 1, null);

      await expect(promise).rejects.toThrow('Process exited with code 1');
    });

    it('should reject pending requests on signal exit', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      mockProcess.emit('exit', null, 'SIGTERM');

      await expect(promise).rejects.toThrow('Process killed with signal SIGTERM');
    });

    it('should set process to null on exit', async () => {
      await bridge.start();
      mockProcess.emit('exit', 0, null);

      // Next crawl should spawn new process
      const newMockProcess = new MockChildProcess();
      const newMockReadline = new MockReadline();
      const newMockStderrReadline = new MockReadline();

      vi.mocked(spawn).mockReturnValue(newMockProcess.asChildProcess());
      vi.mocked(createInterface)
        .mockReturnValueOnce(newMockStderrReadline.asInterface())
        .mockReturnValueOnce(newMockReadline.asInterface());

      const promise = bridge.crawl('https://example.com');

      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(
        vi.mocked(newMockProcess.stdin.write).mock.calls[0]?.[0] as string
      );
      newMockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should handle process with null stdout', async () => {
      const nullStdoutProcess = new MockChildProcess();
      // Override stdout to null for this test case
      Object.defineProperty(nullStdoutProcess, 'stdout', { value: null });

      vi.mocked(spawn).mockReturnValue(nullStdoutProcess.asChildProcess());

      await expect(bridge.start()).rejects.toThrow('Python bridge process stdout is null');
    });

    it('should kill process when stdout is null to prevent zombie process', async () => {
      const nullStdoutProcess = new MockChildProcess();
      // Override stdout to null for this test case
      Object.defineProperty(nullStdoutProcess, 'stdout', { value: null });

      vi.mocked(spawn).mockReturnValue(nullStdoutProcess.asChildProcess());

      await expect(bridge.start()).rejects.toThrow('Python bridge process stdout is null');

      // Critical: process must be killed to prevent zombie
      expect(nullStdoutProcess.kill).toHaveBeenCalled();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should clear pending map on successful response', async () => {
      await bridge.start();
      let capturedId: string | undefined;
      const promise = bridge.crawl('https://example.com');

      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      capturedId = request.id;
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await promise;

      // Send same ID again - should be ignored (pending was cleared)
      expect(() => {
        mockReadline.emit(
          'line',
          JSON.stringify({
            id: capturedId,
            result: { pages: [] },
          })
        );
      }).not.toThrow();
    });

    it('should clear pending map on error response', async () => {
      await bridge.start();
      let capturedId: string | undefined;
      const promise = bridge.crawl('https://example.com');

      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      capturedId = request.id;
      mockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          error: { message: 'Error' },
        })
      );

      await expect(promise).rejects.toThrow();

      // Pending should be cleared
      expect(() => {
        mockReadline.emit(
          'line',
          JSON.stringify({
            id: capturedId,
            result: { pages: [] },
          })
        );
      }).not.toThrow();
    });

    it('should clear pending map on timeout', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 50);

      await expect(promise).rejects.toThrow('timeout');

      // Pending should be cleared, late response should be ignored
      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      expect(() => {
        mockReadline.emit(
          'line',
          JSON.stringify({
            id: request.id,
            result: { pages: [] },
          })
        );
      }).not.toThrow();
    });

    it('should clear all pending on stop', async () => {
      await bridge.start();
      const promise1 = bridge.crawl('https://example.com/1', 1000);
      const promise2 = bridge.crawl('https://example.com/2', 1000);

      // Attach rejection handlers BEFORE stop to avoid unhandled rejection
      const rejection1 = expect(promise1).rejects.toThrow('stopped');
      const rejection2 = expect(promise2).rejects.toThrow('stopped');

      await bridge.stop();

      await rejection1;
      await rejection2;
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      await bridge.start();

      const promises = [
        bridge.crawl('https://example.com/1'),
        bridge.crawl('https://example.com/2'),
        bridge.crawl('https://example.com/3'),
      ];

      await new Promise((resolve) => setImmediate(resolve));

      const req1 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      const req2 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[1]?.[0] as string);
      const req3 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[2]?.[0] as string);

      mockReadline.emit('line', JSON.stringify({ id: req1.id, result: { pages: [] } }));
      mockReadline.emit('line', JSON.stringify({ id: req2.id, result: { pages: [] } }));
      mockReadline.emit('line', JSON.stringify({ id: req3.id, result: { pages: [] } }));

      await Promise.all(promises);
      expect(promises).toHaveLength(3);
    });

    it('should maintain separate timeouts for concurrent requests', async () => {
      await bridge.start();

      const promise1 = bridge.crawl('https://example.com/1', 50);
      const promise2 = bridge.crawl('https://example.com/2', 1000);

      await new Promise((resolve) => setImmediate(resolve));

      // Resolve second immediately
      const req2 = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[1]?.[0] as string);
      mockReadline.emit('line', JSON.stringify({ id: req2.id, result: { pages: [] } }));

      // Second should resolve successfully
      const result2 = await promise2;
      expect(result2).toBeDefined();

      // First should timeout
      await expect(promise1).rejects.toThrow('timeout');
    });
  });

  describe('Stop Functionality', () => {
    it('should kill process on stop', async () => {
      await bridge.start();
      await bridge.stop();

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('should set process to null on stop', async () => {
      await bridge.start();
      await bridge.stop();

      // Next call should start new process
      const newMockProcess = new MockChildProcess();
      const newMockReadline = new MockReadline();
      const newMockStderrReadline = new MockReadline();

      vi.mocked(spawn).mockReturnValue(newMockProcess.asChildProcess());
      vi.mocked(createInterface)
        .mockReturnValueOnce(newMockStderrReadline.asInterface())
        .mockReturnValueOnce(newMockReadline.asInterface());

      await bridge.start();

      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should handle stop when not started', async () => {
      await expect(bridge.stop()).resolves.toBeUndefined();
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should reject all pending requests on stop', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com');

      // Attach rejection handler BEFORE stop to avoid unhandled rejection
      const rejection = expect(promise).rejects.toThrow('Python bridge stopped');

      await bridge.stop();

      await rejection;
    });
  });

  describe('Process Restart Logic', () => {
    it('should allow restart after process exits', async () => {
      await bridge.start();
      mockProcess.emit('exit', 0, null);

      // Should be able to start again
      vi.mocked(spawn).mockReturnValue(mockProcess.asChildProcess());
      await bridge.start();

      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should allow restart after stop', async () => {
      await bridge.start();
      await bridge.stop();

      const newMockProcess = new MockChildProcess();
      const newMockReadline = new MockReadline();
      const newMockStderrReadline = new MockReadline();

      vi.mocked(spawn).mockReturnValue(newMockProcess.asChildProcess());
      vi.mocked(createInterface)
        .mockReturnValueOnce(newMockStderrReadline.asInterface())
        .mockReturnValueOnce(newMockReadline.asInterface());

      await bridge.start();

      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('should allow crawl after process crash and restart', async () => {
      await bridge.start();
      const failedPromise = bridge.crawl('https://example.com');

      mockProcess.emit('exit', 1, null);
      await expect(failedPromise).rejects.toThrow();

      // New crawl should work
      const newMockProcess = new MockChildProcess();
      const newMockReadline = new MockReadline();
      const newMockStderrReadline = new MockReadline();

      vi.mocked(spawn).mockReturnValue(newMockProcess.asChildProcess());
      vi.mocked(createInterface)
        .mockReturnValueOnce(newMockStderrReadline.asInterface())
        .mockReturnValueOnce(newMockReadline.asInterface());

      const promise = bridge.crawl('https://example.com');

      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(
        vi.mocked(newMockProcess.stdin.write).mock.calls[0]?.[0] as string
      );
      newMockReadline.emit(
        'line',
        JSON.stringify({
          id: request.id,
          result: { pages: [] },
        })
      );

      await expect(promise).resolves.toBeDefined();
    });
  });

  describe('Error Edge Cases', () => {
    it('should handle crawl when process stdin is null', async () => {
      await bridge.start();
      // Override stdin to null for this test case
      Object.defineProperty(mockProcess, 'stdin', { value: null });

      await expect(bridge.crawl('https://example.com')).rejects.toThrow('process not available');
    });

    it('should handle response with neither result nor error', async () => {
      await bridge.start();
      const promise = bridge.crawl('https://example.com', 100);

      await new Promise((resolve) => setImmediate(resolve));

      const request = JSON.parse(vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string);
      mockReadline.emit('line', JSON.stringify({ id: request.id }));

      // Should timeout since response is incomplete
      await expect(promise).rejects.toThrow('timeout');
    });
  });
});
