import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStoreCommand } from './store.js';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';
import type { FileStore, RepoStore, WebStore } from '../../types/store.js';
import { createStoreId } from '../../types/brands.js';

vi.mock('../../services/index.js', () => ({
  createServices: vi.fn(),
  destroyServices: vi.fn().mockResolvedValue(undefined),
}));

describe('store command execution', () => {
  let mockServices: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let getOptions: () => GlobalOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServices = {
      store: {
        list: vi.fn(),
        getByIdOrName: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };

    vi.mocked(createServices).mockResolvedValue(mockServices);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    getOptions = () => ({
      config: undefined,
      dataDir: '/tmp/test',
      quiet: false,
      format: undefined,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list subcommand', () => {
    it('lists all stores in normal mode', async () => {
      const mockStores: Array<FileStore | RepoStore | WebStore> = [
        {
          id: createStoreId('store-1'),
          name: 'file-store',
          type: 'file',
          path: '/path/to/files',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: createStoreId('store-2'),
          name: 'repo-store',
          type: 'repo',
          path: '/path/to/repo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: createStoreId('store-3'),
          name: 'web-store',
          type: 'web',
          url: 'https://example.com',
          depth: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockServices.store.list.mockResolvedValue(mockStores);

      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const actionHandler = listCommand?._actionHandler;

      await actionHandler!([]);

      expect(mockServices.store.list).toHaveBeenCalledWith(undefined);
      expect(consoleLogSpy).toHaveBeenCalledWith('\nStores:\n');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file-store (file)'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('repo-store (repo)'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('web-store (web)'));
    });

    it('lists stores filtered by type', async () => {
      const mockStores: FileStore[] = [
        {
          id: createStoreId('store-1'),
          name: 'file-store',
          type: 'file',
          path: '/path/to/files',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockServices.store.list.mockResolvedValue(mockStores);

      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const actionHandler = listCommand?._actionHandler;

      listCommand.parseOptions(['--type', 'file']);
      await actionHandler!([]);

      expect(mockServices.store.list).toHaveBeenCalledWith('file');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('file-store (file)'));
    });

    it('shows message when no stores found', async () => {
      mockServices.store.list.mockResolvedValue([]);

      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const actionHandler = listCommand?._actionHandler;

      await actionHandler!([]);

      expect(consoleLogSpy).toHaveBeenCalledWith('No stores found.');
    });

    it('outputs JSON when format is json', async () => {
      const mockStores: FileStore[] = [
        {
          id: createStoreId('store-1'),
          name: 'file-store',
          type: 'file',
          path: '/path/to/files',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockServices.store.list.mockResolvedValue(mockStores);

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const actionHandler = listCommand?._actionHandler;

      await actionHandler!([]);

      const jsonOutput = consoleLogSpy.mock.calls[0][0];
      expect(jsonOutput).toContain('"name": "file-store"');
      expect(jsonOutput).toContain('"type": "file"');
    });

    it('outputs store names only in quiet mode', async () => {
      const mockStores: Array<FileStore | RepoStore> = [
        {
          id: createStoreId('store-1'),
          name: 'store1',
          type: 'file',
          path: '/path/to/files',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: createStoreId('store-2'),
          name: 'store2',
          type: 'repo',
          path: '/path/to/repo',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockServices.store.list.mockResolvedValue(mockStores);

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: true,
        format: undefined,
      });

      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const actionHandler = listCommand?._actionHandler;

      await actionHandler!([]);

      expect(consoleLogSpy).toHaveBeenCalledWith('store1');
      expect(consoleLogSpy).toHaveBeenCalledWith('store2');
    });
  });

  describe('create subcommand', () => {
    it('creates a file store successfully', async () => {
      const mockStore: FileStore = {
        id: createStoreId('new-store-1'),
        name: 'my-files',
        type: 'file',
        path: '/path/to/files',
        description: 'My file store',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files', '--description', 'My file store']);
      await actionHandler!(['my-files']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'my-files',
        type: 'file',
        path: '/path/to/files',
        url: undefined,
        description: 'My file store',
        tags: undefined,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created store: my-files')
      );
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('creates a repo store successfully', async () => {
      const mockStore: RepoStore = {
        id: createStoreId('new-store-2'),
        name: 'my-repo',
        type: 'repo',
        path: '/path/to/repo',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'repo', '--source', '/path/to/repo']);
      await actionHandler!(['my-repo']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'my-repo',
        type: 'repo',
        path: '/path/to/repo',
        url: undefined,
        description: undefined,
        tags: undefined,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created store: my-repo')
      );
    });

    it('creates a web store successfully', async () => {
      const mockStore: WebStore = {
        id: createStoreId('new-store-3'),
        name: 'my-docs',
        type: 'web',
        url: 'https://docs.example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'web', '--source', 'https://docs.example.com']);
      await actionHandler!(['my-docs']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'my-docs',
        type: 'web',
        path: undefined,
        url: 'https://docs.example.com',
        description: undefined,
        tags: undefined,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created store: my-docs')
      );
    });

    it('creates store with tags', async () => {
      const mockStore: FileStore = {
        id: createStoreId('new-store-4'),
        name: 'tagged-store',
        type: 'file',
        path: '/path/to/files',
        tags: ['typescript', 'react', 'frontend'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files', '--tags', 'typescript, react, frontend']);
      await actionHandler!(['tagged-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'tagged-store',
        type: 'file',
        path: '/path/to/files',
        url: undefined,
        description: undefined,
        tags: ['typescript', 'react', 'frontend'],
      });
    });

    it('outputs JSON when format is json', async () => {
      const mockStore: FileStore = {
        id: createStoreId('new-store-5'),
        name: 'json-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files']);
      await actionHandler!(['json-store']);

      const jsonOutput = consoleLogSpy.mock.calls[0][0];
      expect(jsonOutput).toContain('"name": "json-store"');
      expect(jsonOutput).toContain('"type": "file"');
    });

    it('exits with code 1 when creation fails', async () => {
      mockServices.store.create.mockResolvedValue({
        success: false,
        error: {
          message: 'Store already exists',
        },
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files']);
      await expect(actionHandler!(['duplicate-store'])).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store already exists');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('info subcommand', () => {
    it('displays file store info in normal mode', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        description: 'My file store',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await actionHandler!(['my-store']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('my-store');
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Store: my-store'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Type: file'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Path: /path/to/files'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Description: My file store')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Created: 2024-01-01T00:00:00.000Z')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated: 2024-01-02T00:00:00.000Z')
      );
    });

    it('displays repo store info with URL', async () => {
      const mockStore: RepoStore = {
        id: createStoreId('store-2'),
        name: 'my-repo',
        type: 'repo',
        path: '/path/to/repo',
        url: 'https://github.com/user/repo.git',
        branch: 'main',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await actionHandler!(['my-repo']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Store: my-repo'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Type: repo'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Path: /path/to/repo'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://github.com/user/repo.git')
      );
    });

    it('displays web store info', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-3'),
        name: 'my-docs',
        type: 'web',
        url: 'https://docs.example.com',
        depth: 3,
        maxPages: 100,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await actionHandler!(['my-docs']);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Store: my-docs'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Type: web'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://docs.example.com')
      );
    });

    it('outputs JSON when format is json', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      getOptions = () => ({
        config: undefined,
        dataDir: '/tmp/test',
        quiet: false,
        format: 'json',
      });

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await actionHandler!(['my-store']);

      const jsonOutput = consoleLogSpy.mock.calls[0][0];
      expect(jsonOutput).toContain('"name": "my-store"');
      expect(jsonOutput).toContain('"type": "file"');
    });

    it('exits with code 3 when store not found', async () => {
      mockServices.store.getByIdOrName.mockResolvedValue(undefined);

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await expect(actionHandler!(['nonexistent'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store not found: nonexistent');
      expect(processExitSpy).toHaveBeenCalledWith(3);
    });

    it('can lookup store by ID', async () => {
      const storeId = 'store-123';
      const mockStore: FileStore = {
        id: createStoreId(storeId),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      const command = createStoreCommand(getOptions);
      const infoCommand = command.commands.find(c => c.name() === 'info');
      const actionHandler = infoCommand?._actionHandler;

      await actionHandler!([storeId]);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith(storeId);
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Store: my-store'));
    });
  });

  describe('delete subcommand', () => {
    it('deletes store with --force flag', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'delete-me',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.store.delete.mockResolvedValue({
        success: true,
      });

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      deleteCommand.parseOptions(['--force']);
      await actionHandler!(['delete-me']);

      expect(mockServices.store.getByIdOrName).toHaveBeenCalledWith('delete-me');
      expect(mockServices.store.delete).toHaveBeenCalledWith(mockStore.id);
      expect(consoleLogSpy).toHaveBeenCalledWith('Deleted store: delete-me');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('deletes store with -y flag', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'delete-me',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.store.delete.mockResolvedValue({
        success: true,
      });

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      deleteCommand.parseOptions(['--yes']);
      await actionHandler!(['delete-me']);

      expect(mockServices.store.delete).toHaveBeenCalledWith(mockStore.id);
      expect(consoleLogSpy).toHaveBeenCalledWith('Deleted store: delete-me');
    });

    it('exits with code 3 when store not found', async () => {
      mockServices.store.getByIdOrName.mockResolvedValue(undefined);

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      deleteCommand.parseOptions(['--force']);
      await expect(actionHandler!(['nonexistent'])).rejects.toThrow('process.exit: 3');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store not found: nonexistent');
      expect(processExitSpy).toHaveBeenCalledWith(3);
      expect(mockServices.store.delete).not.toHaveBeenCalled();
    });

    it('exits with code 1 when deletion fails', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'locked-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.store.delete.mockResolvedValue({
        success: false,
        error: {
          message: 'Store is locked',
        },
      });

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      deleteCommand.parseOptions(['--force']);
      await expect(actionHandler!(['locked-store'])).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Store is locked');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('exits with code 1 when force not provided in non-TTY mode', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      // Mock process.stdin.isTTY to be false
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
      });

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      await expect(actionHandler!(['my-store'])).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Use --force or -y to delete without confirmation in non-interactive mode'
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(mockServices.store.delete).not.toHaveBeenCalled();

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    });

    it('prompts for confirmation in TTY mode when user confirms', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);
      mockServices.store.delete.mockResolvedValue({
        success: true,
      });

      // Mock process.stdin.isTTY to be true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });

      // Mock readline to simulate user typing 'y'
      const mockReadline = {
        question: vi.fn((prompt: string, callback: (answer: string) => void) => {
          callback('y');
        }),
        close: vi.fn(),
      };

      vi.doMock('node:readline', () => ({
        createInterface: vi.fn(() => mockReadline),
      }));

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      await actionHandler!(['my-store']);

      expect(mockServices.store.delete).toHaveBeenCalledWith(mockStore.id);
      expect(consoleLogSpy).toHaveBeenCalledWith('Deleted store: my-store');

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    });

    it('cancels deletion when user declines in TTY mode', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'my-store',
        type: 'file',
        path: '/path/to/files',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.getByIdOrName.mockResolvedValue(mockStore);

      // Mock process.stdin.isTTY to be true
      const originalIsTTY = process.stdin.isTTY;
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        configurable: true,
      });

      // Mock readline to simulate user typing 'n'
      const mockReadline = {
        question: vi.fn((prompt: string, callback: (answer: string) => void) => {
          callback('n');
        }),
        close: vi.fn(),
      };

      vi.doMock('node:readline', () => ({
        createInterface: vi.fn(() => mockReadline),
      }));

      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');
      const actionHandler = deleteCommand?._actionHandler;

      await expect(actionHandler!(['my-store'])).rejects.toThrow('process.exit: 0');

      expect(consoleLogSpy).toHaveBeenCalledWith('Cancelled.');
      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(mockServices.store.delete).not.toHaveBeenCalled();

      // Restore original value
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        configurable: true,
      });
    });
  });

  describe('command structure', () => {
    it('creates store command with all subcommands', () => {
      const command = createStoreCommand(getOptions);

      expect(command.name()).toBe('store');
      expect(command.commands.length).toBe(4);
      expect(command.commands.map(c => c.name())).toEqual(['list', 'create', 'info', 'delete']);
    });

    it('list subcommand has type option', () => {
      const command = createStoreCommand(getOptions);
      const listCommand = command.commands.find(c => c.name() === 'list');
      const typeOption = listCommand?.options.find(o => o.long === '--type');

      expect(typeOption).toBeDefined();
    });

    it('create subcommand has required options', () => {
      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');

      const typeOption = createCommand?.options.find(o => o.long === '--type');
      const sourceOption = createCommand?.options.find(o => o.long === '--source');
      const descriptionOption = createCommand?.options.find(o => o.long === '--description');
      const tagsOption = createCommand?.options.find(o => o.long === '--tags');

      expect(typeOption).toBeDefined();
      expect(typeOption?.mandatory).toBe(true);
      expect(sourceOption).toBeDefined();
      expect(sourceOption?.mandatory).toBe(true);
      expect(descriptionOption).toBeDefined();
      expect(descriptionOption?.mandatory).toBe(false);
      expect(tagsOption).toBeDefined();
      expect(tagsOption?.mandatory).toBe(false);
    });

    it('delete subcommand has force and yes options', () => {
      const command = createStoreCommand(getOptions);
      const deleteCommand = command.commands.find(c => c.name() === 'delete');

      const forceOption = deleteCommand?.options.find(o => o.long === '--force');
      const yesOption = deleteCommand?.options.find(o => o.long === '--yes');

      expect(forceOption).toBeDefined();
      expect(yesOption).toBeDefined();
    });
  });

  describe('tags parsing', () => {
    it('parses comma-separated tags correctly', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'tagged-store',
        type: 'file',
        path: '/path/to/files',
        tags: ['tag1', 'tag2', 'tag3'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files', '--tags', 'tag1, tag2, tag3']);
      await actionHandler!(['tagged-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['tag1', 'tag2', 'tag3'],
        })
      );
    });

    it('handles tags with extra whitespace', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'tagged-store',
        type: 'file',
        path: '/path/to/files',
        tags: ['tag1', 'tag2'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/path/to/files', '--tags', '  tag1  ,  tag2  ']);
      await actionHandler!(['tagged-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['tag1', 'tag2'],
        })
      );
    });
  });

  describe('source routing for store types', () => {
    it('routes source to path for file stores', async () => {
      const mockStore: FileStore = {
        id: createStoreId('store-1'),
        name: 'file-store',
        type: 'file',
        path: '/local/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'file', '--source', '/local/path']);
      await actionHandler!(['file-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'file-store',
        type: 'file',
        path: '/local/path',
        url: undefined,
        description: undefined,
        tags: undefined,
      });
    });

    it('routes source to path for repo stores', async () => {
      const mockStore: RepoStore = {
        id: createStoreId('store-2'),
        name: 'repo-store',
        type: 'repo',
        path: '/repo/path',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'repo', '--source', '/repo/path']);
      await actionHandler!(['repo-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'repo-store',
        type: 'repo',
        path: '/repo/path',
        url: undefined,
        description: undefined,
        tags: undefined,
      });
    });

    it('routes source to url for web stores', async () => {
      const mockStore: WebStore = {
        id: createStoreId('store-3'),
        name: 'web-store',
        type: 'web',
        url: 'https://example.com',
        depth: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockServices.store.create.mockResolvedValue({
        success: true,
        data: mockStore,
      });

      const command = createStoreCommand(getOptions);
      const createCommand = command.commands.find(c => c.name() === 'create');
      const actionHandler = createCommand?._actionHandler;

      createCommand.parseOptions(['--type', 'web', '--source', 'https://example.com']);
      await actionHandler!(['web-store']);

      expect(mockServices.store.create).toHaveBeenCalledWith({
        name: 'web-store',
        type: 'web',
        path: undefined,
        url: 'https://example.com',
        description: undefined,
        tags: undefined,
      });
    });
  });
});
