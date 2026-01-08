/**
 * Comprehensive tests for ClaudeClient
 * Coverage: determineCrawlUrls, extractContent, subprocess management, timeouts, JSON parsing, exit codes, truncation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeClient } from './claude-client.js';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(),
}));

const { spawn, execSync } = await import('node:child_process');

describe('ClaudeClient', () => {
  let client: ClaudeClient;
  let mockProcess: MockChildProcess;

  class MockChildProcess extends EventEmitter {
    stdin = {
      write: vi.fn(),
      end: vi.fn(),
    };
    stdout = new EventEmitter();
    stderr = new EventEmitter();
    kill = vi.fn();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    ClaudeClient.resetAvailabilityCache(); // Reset static cache between tests
    client = new ClaudeClient({ timeout: 100 }); // Short timeout for tests
    mockProcess = new MockChildProcess();
    vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);
  });

  describe('isAvailable', () => {
    it('should return true when claude is in PATH', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/local/bin/claude'));

      expect(ClaudeClient.isAvailable()).toBe(true);
      expect(execSync).toHaveBeenCalledWith('which claude', { stdio: 'ignore' });
    });

    it('should return false when claude is not in PATH', () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Command not found');
      });

      expect(ClaudeClient.isAvailable()).toBe(false);
    });

    it('should cache the result after first check', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/local/bin/claude'));

      // First call
      expect(ClaudeClient.isAvailable()).toBe(true);
      expect(execSync).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      expect(ClaudeClient.isAvailable()).toBe(true);
      expect(execSync).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should reset cache with resetAvailabilityCache', () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/local/bin/claude'));

      expect(ClaudeClient.isAvailable()).toBe(true);
      expect(execSync).toHaveBeenCalledTimes(1);

      ClaudeClient.resetAvailabilityCache();

      expect(ClaudeClient.isAvailable()).toBe(true);
      expect(execSync).toHaveBeenCalledTimes(2); // Called again after reset
    });
  });

  describe('determineCrawlUrls', () => {
    it('should successfully parse valid crawl strategy response', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all docs');

      // Simulate successful response
      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1', 'https://example.com/page2'],
              reasoning: 'Found documentation pages',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result.urls).toEqual(['https://example.com/page1', 'https://example.com/page2']);
      expect(result.reasoning).toBe('Found documentation pages');
    });

    it('should call spawn with correct arguments for determineCrawlUrls', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all docs');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1'],
              reasoning: 'Test',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '-p',
          '--json-schema',
          expect.any(String),
          '--output-format',
          'json',
        ]),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should write prompt to stdin', async () => {
      const promise = client.determineCrawlUrls('<html><body>Test</body></html>', 'Find tutorials');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/tutorial'],
              reasoning: 'Found tutorial',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('Find tutorials')
      );
      expect(mockProcess.stdin.end).toHaveBeenCalled();
    });

    it('should reject when response has no urls array', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              reasoning: 'No URLs found',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should reject when response has empty urls array', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: [],
              reasoning: 'No matching pages',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should reject when response has no reasoning', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1'],
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should reject when urls contains non-string values', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1', 123, null],
              reasoning: 'Mixed types',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should reject when response is not valid JSON', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Not valid JSON'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow();
    });

    it('should reject when response is null', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('null'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should truncate HTML longer than 50000 characters', async () => {
      const longHtml = '<html>' + 'a'.repeat(60000) + '</html>';
      const promise = client.determineCrawlUrls(longHtml, 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1'],
              reasoning: 'Test',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      const writtenPrompt = vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string;
      expect(writtenPrompt).toContain('[... HTML truncated ...]');
      expect(writtenPrompt.length).toBeLessThan(longHtml.length);
    });

    it('should not truncate HTML shorter than 50000 characters', async () => {
      const shortHtml = '<html><body>Short content</body></html>';
      const promise = client.determineCrawlUrls(shortHtml, 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1'],
              reasoning: 'Test',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      const writtenPrompt = vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string;
      expect(writtenPrompt).toContain(shortHtml);
      expect(writtenPrompt).not.toContain('[... HTML truncated ...]');
    });
  });

  describe('extractContent', () => {
    it('should successfully extract content', async () => {
      const promise = client.extractContent(
        '# Documentation\n\nPricing: $10/month',
        'Extract pricing info'
      );

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('The pricing is $10/month\n'));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result).toBe('The pricing is $10/month');
    });

    it('should call spawn without JSON schema for extraction', async () => {
      const promise = client.extractContent('# Test', 'Extract summary');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Summary text'));
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['-p'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('should trim whitespace from extracted content', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('  \n  Extracted content  \n  '));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result).toBe('Extracted content');
    });

    it('should truncate markdown longer than 100000 characters', async () => {
      const longMarkdown = '# Title\n' + 'Content '.repeat(20000);
      const promise = client.extractContent(longMarkdown, 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Result'));
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      const writtenPrompt = vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string;
      expect(writtenPrompt).toContain('[... content truncated ...]');
      expect(writtenPrompt.length).toBeLessThan(longMarkdown.length);
    });

    it('should not truncate markdown shorter than 100000 characters', async () => {
      const shortMarkdown = '# Title\n\nShort content';
      const promise = client.extractContent(shortMarkdown, 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Result'));
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      const writtenPrompt = vi.mocked(mockProcess.stdin.write).mock.calls[0]?.[0] as string;
      expect(writtenPrompt).toContain(shortMarkdown);
      expect(writtenPrompt).not.toContain('[... content truncated ...]');
    });
  });

  describe('Subprocess Management', () => {
    it('should handle process spawn errors', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.emit('error', new Error('spawn ENOENT'));
      }, 10);

      await expect(promise).rejects.toThrow('Failed to spawn Claude CLI');
    });

    it('should collect stdout data across multiple chunks', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('First '));
        mockProcess.stdout.emit('data', Buffer.from('chunk '));
        mockProcess.stdout.emit('data', Buffer.from('of data'));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result).toBe('First chunk of data');
    });

    it('should collect stderr data', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error message 1\n'));
        mockProcess.stderr.emit('data', Buffer.from('Error message 2\n'));
        mockProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Error message 1');
    });

    it('should handle process close with exit code 0', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Success'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).resolves.toBe('Success');
    });

    it('should reject on non-zero exit code', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('exited with code 1');
    });

    it('should include stderr in error message on non-zero exit', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Authentication failed'));
        mockProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Authentication failed');
    });

    it('should handle null exit code', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.emit('close', null);
      }, 10);

      await expect(promise).rejects.toThrow('exited with code null');
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after configured timeout period', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      // Don't emit close event - let it timeout
      await expect(promise).rejects.toThrow('timed out after 100ms');
    });

    it('should kill process on timeout', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      await expect(promise).rejects.toThrow('timed out');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should clear timeout on successful completion', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Result'));
        mockProcess.emit('close', 0);
      }, 10);

      await promise;

      // If timeout wasn't cleared, it would have killed the process
      // This test passing means timeout was cleared
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should clear timeout on error', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.emit('error', new Error('Spawn error'));
      }, 10);

      await expect(promise).rejects.toThrow();
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('should use default timeout of 30000ms when not specified', async () => {
      const defaultClient = new ClaudeClient();
      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);

      const promise = defaultClient.extractContent('# Test', 'Extract');

      // Should not timeout quickly
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Complete before default timeout
      mockProcess.stdout.emit('data', Buffer.from('Result'));
      mockProcess.emit('close', 0);

      await expect(promise).resolves.toBe('Result');
    });

    it('should allow timeout of 0 to disable timeout', async () => {
      const noTimeoutClient = new ClaudeClient({ timeout: 0 });
      vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);

      const promise = noTimeoutClient.extractContent('# Test', 'Extract');

      // Wait longer than normal timeout would be
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should still be waiting (no timeout)
      mockProcess.stdout.emit('data', Buffer.from('Result'));
      mockProcess.emit('close', 0);

      await expect(promise).resolves.toBe('Result');
    });
  });

  describe('JSON Parsing', () => {
    it('should handle malformed JSON in response', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('{ invalid json }'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow();
    });

    it('should handle incomplete JSON in response', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('{"urls": ["https://example.com"'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow();
    });

    it('should handle JSON with extra whitespace', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(`
          {
            "urls": ["https://example.com/page1"],
            "reasoning": "Found page"
          }
        `)
        );
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result.urls).toEqual(['https://example.com/page1']);
    });

    it('should handle JSON arrays as invalid for determineCrawlUrls', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('[]'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should handle JSON primitives as invalid for determineCrawlUrls', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('"string response"'));
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });
  });

  describe('Response Validation', () => {
    it('should validate urls is an array', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: 'not an array',
              reasoning: 'Test',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should validate reasoning is a string', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: ['https://example.com/page1'],
              reasoning: 123,
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      await expect(promise).rejects.toThrow('invalid crawl strategy');
    });

    it('should accept valid response with multiple URLs', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              urls: [
                'https://example.com/page1',
                'https://example.com/page2',
                'https://example.com/page3',
              ],
              reasoning: 'Found 3 documentation pages',
            })
          )
        );
        mockProcess.emit('close', 0);
      }, 10);

      const result = await promise;
      expect(result.urls).toHaveLength(3);
      expect(result.reasoning).toBe('Found 3 documentation pages');
    });
  });

  describe('Error Messages', () => {
    it('should wrap errors with context for determineCrawlUrls', async () => {
      const promise = client.determineCrawlUrls('<html>test</html>', 'Find all');

      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Failed to determine crawl strategy');
    });

    it('should wrap errors with context for extractContent', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.emit('close', 1);
      }, 10);

      await expect(promise).rejects.toThrow('Failed to extract content');
    });

    it('should preserve original error message in wrapped error', async () => {
      const promise = client.extractContent('# Test', 'Extract');

      setTimeout(() => {
        mockProcess.emit('error', new Error('ENOENT: no such file'));
      }, 10);

      await expect(promise).rejects.toThrow('ENOENT: no such file');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests', async () => {
      const mockProcess1 = new MockChildProcess();
      const mockProcess2 = new MockChildProcess();

      vi.mocked(spawn)
        .mockReturnValueOnce(mockProcess1 as unknown as ChildProcess)
        .mockReturnValueOnce(mockProcess2 as unknown as ChildProcess);

      const promise1 = client.extractContent('# Test 1', 'Extract 1');
      const promise2 = client.extractContent('# Test 2', 'Extract 2');

      setTimeout(() => {
        mockProcess1.stdout.emit('data', Buffer.from('Result 1'));
        mockProcess1.emit('close', 0);
      }, 10);

      setTimeout(() => {
        mockProcess2.stdout.emit('data', Buffer.from('Result 2'));
        mockProcess2.emit('close', 0);
      }, 20);

      const [result1, result2] = await Promise.all([promise1, promise2]);
      expect(result1).toBe('Result 1');
      expect(result2).toBe('Result 2');
    });
  });
});
