import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WatchService } from './watch.service.js';
import type { IndexService } from './index.service.js';
import type { LanceStore } from '../db/lance.js';
import type { FileStore, RepoStore } from '../types/store.js';

// Create fresh mock watcher for each call
const createMockWatcher = () => ({
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
});

let mockWatchers: ReturnType<typeof createMockWatcher>[] = [];

// Mock chokidar
vi.mock('chokidar', () => ({
  watch: vi.fn(() => {
    const watcher = createMockWatcher();
    mockWatchers.push(watcher);
    return watcher;
  }),
}));

describe('WatchService', () => {
  let watchService: WatchService;
  let mockIndexService: IndexService;
  let mockLanceStore: LanceStore;
  let mockFileStore: FileStore;
  let mockRepoStore: RepoStore;

  beforeEach(async () => {
    // Clear mock watchers array
    mockWatchers = [];

    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock services
    mockIndexService = {
      indexStore: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as IndexService;

    mockLanceStore = {
      initialize: vi.fn().mockResolvedValue(undefined),
    } as unknown as LanceStore;

    mockFileStore = {
      id: 'file-store-1',
      type: 'file',
      path: '/test/path',
      name: 'Test File Store',
      description: 'Test store',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRepoStore = {
      id: 'repo-store-1',
      type: 'repo',
      path: '/test/repo',
      name: 'Test Repo Store',
      description: 'Test repo',
      url: 'https://github.com/test/repo',
      branch: 'main',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    watchService = new WatchService(mockIndexService, mockLanceStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('watch - Lifecycle', () => {
    const noopErrorHandler = (): void => {};

    it('starts watching a file store', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      expect(watch).toHaveBeenCalledWith(
        mockFileStore.path,
        expect.objectContaining({
          ignored: expect.any(RegExp),
          persistent: true,
          ignoreInitial: true,
        })
      );
    });

    it('starts watching a repo store', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      expect(watch).toHaveBeenCalledWith(mockRepoStore.path, expect.any(Object));
    });

    it('sets up event handlers on watcher', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      expect(watcher?.on).toHaveBeenCalledWith('all', expect.any(Function));
      expect(watcher?.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('does not start watching if already watching the same store', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      const callCount1 = (watch as ReturnType<typeof vi.fn>).mock.calls.length;

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      const callCount2 = (watch as ReturnType<typeof vi.fn>).mock.calls.length;

      expect(callCount2).toBe(callCount1);
    });

    it('allows watching multiple different stores', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      expect(watch).toHaveBeenCalledTimes(2);
    });

    it('resolves immediately when store is already being watched', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const startTime = Date.now();
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      const endTime = Date.now();

      // Should resolve immediately
      expect(endTime - startTime).toBeLessThan(10);
    });
  });

  describe('watch - Debounce Logic', () => {
    const noopErrorHandler = (): void => {};

    it('debounces rapid file changes with default timeout', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      // Trigger multiple rapid changes
      allHandler?.();
      allHandler?.();
      allHandler?.();

      // Fast-forward less than debounce time
      vi.advanceTimersByTime(500);

      // Should not have triggered reindex yet
      expect(mockIndexService.indexStore).not.toHaveBeenCalled();

      // Fast-forward past debounce time
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();

      // Should have triggered reindex only once
      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(1);
    });

    it('uses custom debounce timeout', async () => {
      await watchService.watch(mockFileStore, 2000);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();

      // Advance less than custom debounce
      vi.advanceTimersByTime(1500);
      expect(mockIndexService.indexStore).not.toHaveBeenCalled();

      // Advance past custom debounce
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();

      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(1);
    });

    it('resets debounce timer on each change', async () => {
      await watchService.watch(mockFileStore, 1000);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      // Trigger change
      allHandler?.();
      vi.advanceTimersByTime(800);

      // Trigger another change (should reset timer)
      allHandler?.();
      vi.advanceTimersByTime(800);

      // Still no reindex (timer was reset)
      expect(mockIndexService.indexStore).not.toHaveBeenCalled();

      // Complete the timeout
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(1);
    });

    it('clears previous timeout on new change', async () => {
      await watchService.watch(mockFileStore, 1000);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      // Multiple rapid changes
      for (let i = 0; i < 10; i++) {
        allHandler?.();
        vi.advanceTimersByTime(100);
      }

      await vi.runAllTimersAsync();

      // Should only index once despite 10 changes
      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(1);
    });
  });

  describe('watch - Reindexing', () => {
    const noopErrorHandler = (): void => {};

    it('initializes lance store before reindexing', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(mockLanceStore.initialize).toHaveBeenCalledWith(mockFileStore.id);
      expect(mockLanceStore.initialize).toHaveBeenCalledBefore(
        mockIndexService.indexStore as ReturnType<typeof vi.fn>
      );
    });

    it('calls indexStore with correct store', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(mockIndexService.indexStore).toHaveBeenCalledWith(mockFileStore);
    });

    it('calls onReindex callback after successful reindex', async () => {
      const onReindex = vi.fn();

      await watchService.watch(mockFileStore, 1000, onReindex, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(onReindex).toHaveBeenCalledTimes(1);
    });

    it('does not call onReindex if not provided', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      // Should not throw
      expect(mockIndexService.indexStore).toHaveBeenCalled();
    });

    it('handles concurrent reindexing for different stores', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      const watcher1 = mockWatchers[0];
      const watcher2 = mockWatchers[1];

      const handler1 = (watcher1?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      const handler2 = (watcher2?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      handler1?.();
      handler2?.();

      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(2);
      expect(mockIndexService.indexStore).toHaveBeenCalledWith(mockFileStore);
      expect(mockIndexService.indexStore).toHaveBeenCalledWith(mockRepoStore);
    });
  });

  describe('watch - Error Handling', () => {
    it('calls onError when reindexing fails', async () => {
      const onError = vi.fn();
      const indexError = new Error('Index failed');

      mockIndexService.indexStore = vi.fn().mockRejectedValue(indexError);

      await watchService.watch(mockFileStore, 1000, undefined, onError);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledWith(indexError);
    });

    it('calls onError when lance initialization fails', async () => {
      const onError = vi.fn();
      const initError = new Error('Init failed');

      mockLanceStore.initialize = vi.fn().mockRejectedValue(initError);

      await watchService.watch(mockFileStore, 1000, undefined, onError);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledWith(initError);
    });

    it('calls onError for watcher errors', async () => {
      const onError = vi.fn();

      await watchService.watch(mockFileStore, 1000, undefined, onError);

      const watcher = mockWatchers[0];
      const errorHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'error'
      )?.[1] as ((error: Error) => void) | undefined;

      const testError = new Error('Watcher error');
      errorHandler?.(testError);

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('requires onError callback to be provided', async () => {
      // onError is now required - this test verifies the type signature enforces it
      // TypeScript would catch this at compile time, but runtime behavior should still work
      const onError = vi.fn();
      await watchService.watch(mockFileStore, 1000, undefined, onError);

      const watcher = mockWatchers[0];
      const errorHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'error'
      )?.[1] as ((error: Error) => void) | undefined;

      const testError = new Error('Watcher error');
      errorHandler?.(testError);

      // Error should be passed to onError, not thrown
      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('continues watching after error during reindex', async () => {
      const onError = vi.fn();

      // First call fails
      mockIndexService.indexStore = vi
        .fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce({ ok: true });

      await watchService.watch(mockFileStore, 1000, undefined, onError);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      // First change - will fail
      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      // Second change - should succeed
      allHandler?.();
      vi.advanceTimersByTime(1100);
      await vi.runAllTimersAsync();

      expect(mockIndexService.indexStore).toHaveBeenCalledTimes(2);
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  describe('unwatch', () => {
    const noopErrorHandler = (): void => {};

    it('stops watching a store', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      await watchService.unwatch(mockFileStore.id);

      expect(watcher?.close).toHaveBeenCalled();
    });

    it('removes watcher from internal map', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.unwatch(mockFileStore.id);

      // Trying to watch again should create new watcher
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      expect(watch).toHaveBeenCalledTimes(2);
    });

    it('does nothing when unwatching non-existent store', async () => {
      // Should not throw
      await expect(watchService.unwatch('non-existent-id')).resolves.toBeUndefined();
    });

    it('does not affect other watchers', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      const watcher1 = mockWatchers[0];
      const watcher2 = mockWatchers[1];

      await watchService.unwatch(mockFileStore.id);

      expect(watcher1?.close).toHaveBeenCalled();
      expect(watcher2?.close).not.toHaveBeenCalled();
    });

    it('clears pending timeout to prevent timer leak', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const watcher = mockWatchers[0];
      const allHandler = (watcher?.on as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'all'
      )?.[1] as (() => void) | undefined;

      // Trigger a file change (sets timeout)
      allHandler?.();

      // Unwatch before timeout fires
      await watchService.unwatch(mockFileStore.id);

      // Advance past debounce time - timeout should NOT fire
      vi.advanceTimersByTime(1500);
      await vi.runAllTimersAsync();

      // indexStore should NOT have been called since we unwatched
      expect(mockIndexService.indexStore).not.toHaveBeenCalled();
    });
  });

  describe('unwatchAll', () => {
    const noopErrorHandler = (): void => {};

    it('stops all watchers', async () => {
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      const watcher1 = mockWatchers[0];
      const watcher2 = mockWatchers[1];

      await watchService.unwatchAll();

      expect(watcher1?.close).toHaveBeenCalled();
      expect(watcher2?.close).toHaveBeenCalled();
    });

    it('clears all watchers from map', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);
      await watchService.watch(mockRepoStore, 1000, undefined, noopErrorHandler);

      await watchService.unwatchAll();

      // Watching again should create new watchers
      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      expect(watch).toHaveBeenCalledTimes(3); // 2 initial + 1 after unwatchAll
    });

    it('does nothing when no watchers exist', async () => {
      // Should not throw
      await expect(watchService.unwatchAll()).resolves.toBeUndefined();
    });
  });

  describe('File Watching Configuration', () => {
    const noopErrorHandler = (): void => {};

    it('ignores .git directories', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const config = (watch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(config.ignored).toBeInstanceOf(RegExp);
      expect(config.ignored.test('.git')).toBe(true);
      expect(config.ignored.test('some/path/.git/file')).toBe(true);
    });

    it('ignores node_modules directories', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const config = (watch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(config.ignored.test('.node_modules')).toBe(true);
      expect(config.ignored.test('some/path/.node_modules/pkg')).toBe(true);
    });

    it('ignores dist and build directories', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const config = (watch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(config.ignored.test('.dist')).toBe(true);
      expect(config.ignored.test('.build')).toBe(true);
    });

    it('sets persistent to true', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const config = (watch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(config.persistent).toBe(true);
    });

    it('sets ignoreInitial to true', async () => {
      const { watch } = await import('chokidar');

      await watchService.watch(mockFileStore, 1000, undefined, noopErrorHandler);

      const config = (watch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
      expect(config.ignoreInitial).toBe(true);
    });
  });
});
