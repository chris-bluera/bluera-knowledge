import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleExecute } from './execute.handler.js';
import type { HandlerContext } from '../types.js';
import type { ExecuteArgs } from '../schemas/index.js';
import { JobService } from '../../services/job.service.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('execute.handler', () => {
  let tempDir: string;
  let mockContext: HandlerContext;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'execute-handler-test-'));
    mockContext = {
      services: {
        store: {
          list: async () => [],
          getByIdOrName: async () => undefined,
          create: async () => ({ success: false, error: { message: 'Not implemented in test' } }),
          delete: async () => ({ success: false, error: { message: 'Not implemented in test' } }),
        },
        lance: {
          deleteStore: async () => {},
        },
      } as unknown as HandlerContext['services'],
      options: { dataDir: tempDir },
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('meta commands', () => {
    it('should handle "commands" command', async () => {
      const args: ExecuteArgs = { command: 'commands' };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.commands).toBeDefined();
      expect(Array.isArray(data.commands)).toBe(true);

      // Should include known commands
      const commandNames = data.commands.map((c: { name: string }) => c.name);
      expect(commandNames).toContain('stores');
      expect(commandNames).toContain('store:create');
      expect(commandNames).toContain('jobs');
      expect(commandNames).toContain('help');
    });

    it('should handle "help" command without args', async () => {
      const args: ExecuteArgs = { command: 'help' };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const text = result.content[0].text;
      expect(text).toContain('Available commands');
      expect(text).toContain('stores');
      expect(text).toContain('store:');
      expect(text).toContain('job:');
    });

    it('should handle "help" command with specific command', async () => {
      const args: ExecuteArgs = { command: 'help', args: { command: 'stores' } };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const text = result.content[0].text;
      expect(text).toContain('Command: stores');
      expect(text).toContain('Description:');
    });
  });

  describe('store commands', () => {
    it('should handle "stores" command', async () => {
      const args: ExecuteArgs = { command: 'stores' };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.stores).toBeDefined();
      expect(Array.isArray(data.stores)).toBe(true);
    });

    it('should handle "store:info" command', async () => {
      const args: ExecuteArgs = {
        command: 'store:info',
        args: { store: 'nonexistent' },
      };

      // Should throw since store doesn't exist
      await expect(handleExecute(args, mockContext)).rejects.toThrow('Store not found');
    });
  });

  describe('job commands', () => {
    it('should handle "jobs" command', async () => {
      const args: ExecuteArgs = { command: 'jobs' };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.jobs).toBeDefined();
      expect(Array.isArray(data.jobs)).toBe(true);
    });

    it('should handle "job:status" command', async () => {
      // Create a job first
      const jobService = new JobService(tempDir);
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test-store' },
        message: 'Testing...',
      });

      const args: ExecuteArgs = {
        command: 'job:status',
        args: { jobId: job.id },
      };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.id).toBe(job.id);
      expect(data.status).toBe('pending');
    });

    it('should handle "job:cancel" command', async () => {
      // Create a job first
      const jobService = new JobService(tempDir);
      const job = jobService.createJob({
        type: 'index',
        details: { storeId: 'test-store' },
        message: 'Testing...',
      });

      const args: ExecuteArgs = {
        command: 'job:cancel',
        args: { jobId: job.id },
      };
      const result = await handleExecute(args, mockContext);

      expect(result.content).toHaveLength(1);
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.job.status).toBe('cancelled');
    });
  });

  describe('error handling', () => {
    it('should throw for unknown command', async () => {
      const args: ExecuteArgs = { command: 'unknown-command' };

      await expect(handleExecute(args, mockContext)).rejects.toThrow(
        'Unknown command: unknown-command'
      );
    });

    it('should validate command is required', async () => {
      const args = {} as ExecuteArgs;

      await expect(handleExecute(args, mockContext)).rejects.toThrow();
    });

    it('should throw for help on unknown command', async () => {
      const args: ExecuteArgs = {
        command: 'help',
        args: { command: 'nonexistent' },
      };

      await expect(handleExecute(args, mockContext)).rejects.toThrow(
        'Unknown command: nonexistent'
      );
    });
  });
});
