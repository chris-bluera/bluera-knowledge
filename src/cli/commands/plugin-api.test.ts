import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAddRepoCommand,
  createAddFolderCommand,
  createStoresCommand,
  createSuggestCommand,
} from './plugin-api.js';
import type { GlobalOptions } from '../program.js';

// Mock all plugin command handlers
vi.mock('../../plugin/commands.js', () => ({
  handleAddRepo: vi.fn(),
  handleAddFolder: vi.fn(),
  handleStores: vi.fn(),
  handleSuggest: vi.fn(),
}));

describe('Plugin API Commands - Execution Tests', () => {
  const getOptions = (): GlobalOptions => ({
    config: undefined,
    dataDir: '/tmp/test',
    quiet: false,
    format: undefined,
  });

  beforeEach(async () => {
    const { handleAddRepo, handleAddFolder, handleStores, handleSuggest } =
      await import('../../plugin/commands.js');

    vi.mocked(handleAddRepo).mockClear().mockResolvedValue(undefined);
    vi.mocked(handleAddFolder).mockClear().mockResolvedValue(undefined);
    vi.mocked(handleStores).mockClear().mockResolvedValue(undefined);
    vi.mocked(handleSuggest).mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('add-repo command', () => {
    const expectedGlobalOpts = {
      config: undefined,
      dataDir: '/tmp/test',
      projectRoot: undefined,
      format: undefined,
      quiet: false,
    };

    it('calls handleAddRepo with url and global options', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledWith(
        { url: 'https://github.com/user/repo.git' },
        expectedGlobalOpts
      );
    });

    it('calls handleAddRepo with url and name option', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--name', 'my-repo']);
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledWith(
        { url: 'https://github.com/user/repo.git', name: 'my-repo' },
        expectedGlobalOpts
      );
    });

    it('calls handleAddRepo with url and branch option', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--branch', 'develop']);
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledWith(
        { url: 'https://github.com/user/repo.git', branch: 'develop' },
        expectedGlobalOpts
      );
    });

    it('calls handleAddRepo with all options', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--name', 'custom-name', '--branch', 'main']);
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledWith(
        { url: 'https://github.com/user/repo.git', name: 'custom-name', branch: 'main' },
        expectedGlobalOpts
      );
    });

    it('handles errors from handleAddRepo', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      vi.mocked(handleAddRepo).mockRejectedValue(new Error('Clone failed'));

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler(['https://github.com/user/repo.git'])).rejects.toThrow(
        'Clone failed'
      );
    });
  });

  describe('add-folder command', () => {
    const expectedGlobalOpts = {
      config: undefined,
      dataDir: '/tmp/test',
      projectRoot: undefined,
      format: undefined,
      quiet: false,
    };

    it('calls handleAddFolder with path and global options', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['/path/to/folder']);

      expect(handleAddFolder).toHaveBeenCalledWith({ path: '/path/to/folder' }, expectedGlobalOpts);
    });

    it('calls handleAddFolder with path and name option', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      command.parseOptions(['--name', 'my-folder']);
      await actionHandler(['/path/to/folder']);

      expect(handleAddFolder).toHaveBeenCalledWith(
        { path: '/path/to/folder', name: 'my-folder' },
        expectedGlobalOpts
      );
    });

    it('handles relative paths', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['./relative/path']);

      expect(handleAddFolder).toHaveBeenCalledWith({ path: './relative/path' }, expectedGlobalOpts);
    });

    it('handles paths with spaces', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['/path/with spaces/folder']);

      expect(handleAddFolder).toHaveBeenCalledWith(
        { path: '/path/with spaces/folder' },
        expectedGlobalOpts
      );
    });

    it('handles errors from handleAddFolder', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      vi.mocked(handleAddFolder).mockRejectedValue(new Error('Path not found'));

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler(['/nonexistent'])).rejects.toThrow('Path not found');
    });
  });

  describe('stores command', () => {
    it('calls handleStores with global options', async () => {
      const { handleStores } = await import('../../plugin/commands.js');

      const command = createStoresCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(handleStores).toHaveBeenCalledWith({
        config: undefined,
        dataDir: '/tmp/test',
        projectRoot: undefined,
        format: undefined,
        quiet: false,
      });
    });

    it('calls handleStores exactly once', async () => {
      const { handleStores } = await import('../../plugin/commands.js');

      const command = createStoresCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(handleStores).toHaveBeenCalledTimes(1);
    });

    it('handles errors from handleStores', async () => {
      const { handleStores } = await import('../../plugin/commands.js');

      vi.mocked(handleStores).mockRejectedValue(new Error('Database error'));

      const command = createStoresCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler([])).rejects.toThrow('Database error');
    });
  });

  describe('suggest command', () => {
    it('calls handleSuggest with global options', async () => {
      const { handleSuggest } = await import('../../plugin/commands.js');

      const command = createSuggestCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(handleSuggest).toHaveBeenCalledWith({
        config: undefined,
        dataDir: '/tmp/test',
        projectRoot: undefined,
        format: undefined,
        quiet: false,
      });
    });

    it('calls handleSuggest exactly once', async () => {
      const { handleSuggest } = await import('../../plugin/commands.js');

      const command = createSuggestCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(handleSuggest).toHaveBeenCalledTimes(1);
    });

    it('handles errors from handleSuggest', async () => {
      const { handleSuggest } = await import('../../plugin/commands.js');

      vi.mocked(handleSuggest).mockRejectedValue(new Error('Analysis failed'));

      const command = createSuggestCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;

      await expect(actionHandler([])).rejects.toThrow('Analysis failed');
    });
  });

  describe('command independence', () => {
    it('add-repo does not affect other commands', async () => {
      const { handleAddRepo, handleAddFolder } = await import('../../plugin/commands.js');

      const addRepoCmd = createAddRepoCommand(getOptions);
      const actionHandler = (addRepoCmd as any)._actionHandler;
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledTimes(1);
      expect(handleAddFolder).not.toHaveBeenCalled();
    });

    it('add-folder does not affect other commands', async () => {
      const { handleAddFolder, handleStores } = await import('../../plugin/commands.js');

      const addFolderCmd = createAddFolderCommand(getOptions);
      const actionHandler = (addFolderCmd as any)._actionHandler;
      await actionHandler(['/path']);

      expect(handleAddFolder).toHaveBeenCalledTimes(1);
      expect(handleStores).not.toHaveBeenCalled();
    });

    it('stores command does not affect other commands', async () => {
      const { handleStores, handleSuggest } = await import('../../plugin/commands.js');

      const storesCmd = createStoresCommand(getOptions);
      const actionHandler = (storesCmd as any)._actionHandler;
      await actionHandler([]);

      expect(handleStores).toHaveBeenCalledTimes(1);
      expect(handleSuggest).not.toHaveBeenCalled();
    });

    it('suggest command does not affect other commands', async () => {
      const { handleSuggest, handleAddRepo } = await import('../../plugin/commands.js');

      const suggestCmd = createSuggestCommand(getOptions);
      const actionHandler = (suggestCmd as any)._actionHandler;
      await actionHandler([]);

      expect(handleSuggest).toHaveBeenCalledTimes(1);
      expect(handleAddRepo).not.toHaveBeenCalled();
    });
  });

  describe('global options handling', () => {
    it('add-repo passes global options', async () => {
      const { handleAddRepo } = await import('../../plugin/commands.js');

      const command = createAddRepoCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['https://github.com/user/repo.git']);

      expect(handleAddRepo).toHaveBeenCalledWith(
        { url: 'https://github.com/user/repo.git' },
        {
          config: undefined,
          dataDir: '/tmp/test',
          projectRoot: undefined,
          format: undefined,
          quiet: false,
        }
      );
    });

    it('add-folder passes global options', async () => {
      const { handleAddFolder } = await import('../../plugin/commands.js');

      const command = createAddFolderCommand(getOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler(['/path']);

      expect(handleAddFolder).toHaveBeenCalledWith(
        { path: '/path' },
        {
          config: undefined,
          dataDir: '/tmp/test',
          projectRoot: undefined,
          format: undefined,
          quiet: false,
        }
      );
    });

    it('stores passes dataDir from global options', async () => {
      const { handleStores } = await import('../../plugin/commands.js');

      const customGetOptions = (): GlobalOptions => ({
        config: '/custom/config.json',
        dataDir: '/custom/data',
        quiet: true,
        format: 'json',
        projectRoot: '/my/project',
      });

      const command = createStoresCommand(customGetOptions);
      const actionHandler = (command as any)._actionHandler;
      await actionHandler([]);

      expect(handleStores).toHaveBeenCalledWith({
        config: '/custom/config.json',
        dataDir: '/custom/data',
        projectRoot: '/my/project',
        format: 'json',
        quiet: true,
      });
    });
  });
});
