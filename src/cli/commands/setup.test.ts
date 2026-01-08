import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSetupCommand } from './setup.js';
import type { GlobalOptions } from '../program.js';
import type { ServiceContainer } from '../../services/index.js';
import { DEFAULT_REPOS } from '../../defaults/repos.js';

// Mock all dependencies
vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(() => ({ status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') })),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
}));

vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

describe('Setup Command - Execution Tests', () => {
  let mockServices: ServiceContainer;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  const getOptions = (): GlobalOptions => ({
    config: undefined,
    dataDir: '/tmp/test-data',
    quiet: false,
    format: undefined,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const { createServices } = await import('../../services/index.js');

    mockServices = {
      store: {
        list: vi.fn(),
        getByIdOrName: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      lance: {
        initialize: vi.fn(),
      },
      index: {
        indexStore: vi.fn(),
      },
    } as unknown as ServiceContainer;

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('repos subcommand - list mode', () => {
    it('lists all default repositories without cloning', async () => {
      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      expect(reposCmd).toBeDefined();

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--list']);
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nDefault repositories:\n');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('claude-code-docs'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('claude-code'));

      // Should not create services or perform any operations
      const { createServices } = await import('../../services/index.js');
      expect(createServices).not.toHaveBeenCalled();
    });

    it('displays repository details in list mode', async () => {
      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--list']);
      await actionHandler([]);

      // Check that all repo fields are displayed
      for (const repo of DEFAULT_REPOS) {
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(repo.name));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`URL: ${repo.url}`));
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Description: ${repo.description}`)
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Tags: ${repo.tags.join(', ')}`)
        );
      }
    });
  });

  describe('repos subcommand - filtering', () => {
    it('filters repos by partial name match', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code',
          type: 'repo',
          path: '/tmp/claude-code',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code']);
      await actionHandler([]);

      // Should only process repos matching "claude-code"
      const { createServices } = await import('../../services/index.js');
      expect(createServices).toHaveBeenCalled();

      // Should process at least claude-code and claude-code-docs (partial match)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/Setting up \d+ repositor/));
    });

    it('exits with error when no repos match filter', async () => {
      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'nonexistent-repo']);
      await expect(actionHandler([])).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No repos matched'));
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('handles comma-separated filter values', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'test',
          type: 'repo',
          path: '/tmp/test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'docs,sdk']);
      await actionHandler([]);

      // Should process repos matching either "docs" or "sdk"
      const { createServices } = await import('../../services/index.js');
      expect(createServices).toHaveBeenCalled();
    });
  });

  describe('repos subcommand - cloning', () => {
    it('clones new repos successfully', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      expect(mkdir).toHaveBeenCalled();
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['clone']),
        expect.anything()
      );
    });

    it('pulls latest changes for existing repos', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['pull', '--ff-only'],
        expect.objectContaining({
          stdio: 'pipe',
        })
      );
    });

    it('handles pull failures gracefully', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      // Pull fails (non-zero status) but shouldn't stop execution
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('Pull failed'),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      // Should continue despite pull failure
      expect(mockServices.store.create).toHaveBeenCalled();
    });

    it('handles clone failure with empty stderr', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      // Clone fails with empty stderr - should use fallback message
      vi.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      // Should fail and show spinner.fail
      const ora = (await import('ora')).default;
      expect(ora).toHaveBeenCalled();
      const spinnerInstance = vi.mocked(ora).mock.results[0]?.value;
      expect(spinnerInstance.fail).toHaveBeenCalled();
    });

    it('skips cloning when --skip-clone flag is set', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs', '--skip-clone']);
      await actionHandler([]);

      expect(spawnSync).not.toHaveBeenCalled();
      expect(mockServices.store.create).toHaveBeenCalled();
    });
  });

  describe('repos subcommand - store creation', () => {
    it('creates new stores with correct metadata', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      const repo = DEFAULT_REPOS.find((r) => r.name === 'claude-code-docs')!;
      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: repo.name,
        type: 'repo',
        path: expect.stringContaining('claude-code-docs'),
        description: repo.description,
        tags: repo.tags,
      });
    });

    it('skips creating store if already exists', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue({
        id: 'existing-store',
        name: 'claude-code-docs',
        type: 'repo',
        path: '/tmp/repos/claude-code-docs',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      expect(mockServices.store.create).not.toHaveBeenCalled();
      // But should still index
      expect(mockServices.index.indexStore).toHaveBeenCalled();
    });

    it('handles store creation failure', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: false,
        error: new Error('Store creation failed'),
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      // Should continue with other repos despite failure
      const ora = (await import('ora')).default;
      expect(ora).toHaveBeenCalled();
      const spinnerInstance = vi.mocked(ora).mock.results[0]?.value;
      expect(spinnerInstance.fail).toHaveBeenCalled();
    });
  });

  describe('repos subcommand - indexing', () => {
    it('indexes stores successfully', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName)
        .mockResolvedValueOnce(undefined) // First call - check if store exists
        .mockResolvedValueOnce({
          // Second call - get store for indexing
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 25, chunksCreated: 100, timeMs: 2000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      expect(mockServices.lance.initialize).toHaveBeenCalledWith('store-1');
      expect(mockServices.index.indexStore).toHaveBeenCalled();
    });

    it('skips indexing when --skip-index flag is set', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs', '--skip-index']);
      await actionHandler([]);

      expect(mockServices.index.indexStore).not.toHaveBeenCalled();

      const ora = (await import('ora')).default;
      expect(ora).toHaveBeenCalled();
      const spinnerInstance = vi.mocked(ora).mock.results[0]?.value;
      expect(spinnerInstance.succeed).toHaveBeenCalled();
    });

    it('handles indexing failure', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: false,
        error: new Error('Indexing failed'),
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      const ora = (await import('ora')).default;
      expect(ora).toHaveBeenCalled();
      const spinnerInstance = vi.mocked(ora).mock.results[0]?.value;
      expect(spinnerInstance.fail).toHaveBeenCalled();
    });

    it('reports progress during indexing', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'claude-code-docs',
          type: 'repo',
          path: '/tmp/repos/claude-code-docs',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      vi.mocked(mockServices.index.indexStore).mockImplementation(async (store, onProgress) => {
        // Simulate progress events
        if (onProgress) {
          onProgress({ type: 'progress', current: 5, total: 10 });
          onProgress({ type: 'progress', current: 10, total: 10 });
        }
        return {
          success: true,
          data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
        };
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code-docs']);
      await actionHandler([]);

      const ora = (await import('ora')).default;
      // Check that ora was called (to create spinner instances)
      expect(ora).toHaveBeenCalled();
      // Get the spinner instance that was returned
      const spinnerInstance = vi.mocked(ora).mock.results[0]?.value;
      expect(spinnerInstance.start).toHaveBeenCalled();
      expect(spinnerInstance.succeed).toHaveBeenCalled();
    });
  });

  describe('repos subcommand - directory handling', () => {
    it('creates repos directory if it does not exist', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'test',
          type: 'repo',
          path: '/tmp/test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code', '--repos-dir', '/custom/path']);
      await actionHandler([]);

      expect(mkdir).toHaveBeenCalledWith('/custom/path', { recursive: true });
    });

    it('uses custom repos directory when specified', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'test',
          type: 'repo',
          path: '/custom/path/test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code', '--repos-dir', '/custom/path']);
      await actionHandler([]);

      expect(mockServices.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          path: expect.stringContaining('/custom/path'),
        })
      );
    });
  });

  describe('repos subcommand - completion message', () => {
    it('displays completion message after successful setup', async () => {
      const { existsSync } = await import('node:fs');
      const { mkdir } = await import('node:fs/promises');
      const { spawnSync } = await import('node:child_process');

      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      });

      vi.mocked(mockServices.store.getByIdOrName).mockResolvedValue(undefined);
      vi.mocked(mockServices.store.create).mockResolvedValue({
        success: true,
        data: {
          id: 'store-1',
          name: 'test',
          type: 'repo',
          path: '/tmp/test',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      vi.mocked(mockServices.index.indexStore).mockResolvedValue({
        success: true,
        data: { documentsIndexed: 10, chunksCreated: 50, timeMs: 1000 },
      });

      const command = createSetupCommand(getOptions);
      const reposCmd = command.commands.find((c) => c.name() === 'repos');

      const actionHandler = (reposCmd as any)._actionHandler;
      reposCmd.parseOptions(['--only', 'claude-code']);
      await actionHandler([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Setup complete'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('bluera-knowledge search')
      );
    });
  });
});
