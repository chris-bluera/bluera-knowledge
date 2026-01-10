import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncCommands, handleStoresSync } from './sync.commands.js';
import { StoreService } from '../../services/store.service.js';
import { StoreDefinitionService } from '../../services/store-definition.service.js';
import type { HandlerContext } from '../types.js';
import type { ServiceContainer } from '../../services/index.js';

// Mock spawnBackgroundWorker
vi.mock('../../workers/spawn-worker.js', () => ({
  spawnBackgroundWorker: vi.fn(),
}));

/**
 * Create a minimal mock service container for testing
 */
function createMockServices(storeService: StoreService): ServiceContainer {
  return {
    store: storeService,
    // Other services not needed for sync tests
    config: {} as ServiceContainer['config'],
    search: {} as ServiceContainer['search'],
    index: {} as ServiceContainer['index'],
    lance: {} as ServiceContainer['lance'],
    embeddings: {} as ServiceContainer['embeddings'],
    codeGraph: {} as ServiceContainer['codeGraph'],
    pythonBridge: {} as ServiceContainer['pythonBridge'],
  };
}

describe('sync.commands', () => {
  describe('command definition', () => {
    it('exports stores:sync command', () => {
      const syncCmd = syncCommands.find((c) => c.name === 'stores:sync');
      expect(syncCmd).toBeDefined();
      expect(syncCmd?.description).toContain('Sync');
    });

    it('has correct args schema', () => {
      const syncCmd = syncCommands.find((c) => c.name === 'stores:sync');
      expect(syncCmd?.argsSchema).toBeDefined();

      // Valid empty args
      const result1 = syncCmd?.argsSchema?.safeParse({});
      expect(result1?.success).toBe(true);

      // Valid with options
      const result2 = syncCmd?.argsSchema?.safeParse({
        prune: true,
        dryRun: true,
      });
      expect(result2?.success).toBe(true);

      // Valid with reindex option
      const result3 = syncCmd?.argsSchema?.safeParse({
        reindex: true,
        prune: true,
        dryRun: true,
      });
      expect(result3?.success).toBe(true);
    });
  });

  describe('handleStoresSync', () => {
    let projectRoot: string;
    let dataDir: string;
    let storeService: StoreService;
    let defService: StoreDefinitionService;
    let context: HandlerContext;

    beforeEach(async () => {
      projectRoot = await mkdtemp(join(tmpdir(), 'sync-test-'));
      dataDir = join(projectRoot, '.bluera/bluera-knowledge/data');
      defService = new StoreDefinitionService(projectRoot);
      storeService = new StoreService(dataDir, { definitionService: defService });
      await storeService.initialize();

      context = {
        services: createMockServices(storeService),
        options: { projectRoot, dataDir },
      };
    });

    afterEach(async () => {
      await rm(projectRoot, { recursive: true, force: true });
    });

    describe('creates missing stores', () => {
      it('creates file store from definition', async () => {
        // Create a directory to reference
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Add definition manually (simulating config from git)
        await defService.addDefinition({
          type: 'file',
          name: 'my-docs',
          path: './docs',
          description: 'Documentation',
        });

        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.created).toContain('my-docs');
        expect(response.skipped).toHaveLength(0);
        expect(response.failed).toHaveLength(0);

        // Verify store was created
        const store = await storeService.getByName('my-docs');
        expect(store).toBeDefined();
        expect(store?.type).toBe('file');
      });

      it('creates web store from definition', async () => {
        // Add web store definition
        await defService.addDefinition({
          type: 'web',
          name: 'api-docs',
          url: 'https://example.com/docs',
          depth: 2,
        });

        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.created).toContain('api-docs');

        const store = await storeService.getByName('api-docs');
        expect(store).toBeDefined();
        expect(store?.type).toBe('web');
      });
    });

    describe('skips existing stores', () => {
      it('skips store that already exists', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Create store first (this auto-adds the definition via the integration)
        await storeService.create({
          name: 'existing-docs',
          type: 'file',
          path: docsDir,
        });

        // Definition was auto-added, so sync should skip this store
        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.skipped).toContain('existing-docs');
        expect(response.created).toHaveLength(0);
      });
    });

    describe('reports orphans', () => {
      it('reports stores not in definitions', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Create store without definition (using skipDefinitionSync)
        await storeService.create(
          {
            name: 'orphan-store',
            type: 'file',
            path: docsDir,
          },
          { skipDefinitionSync: true }
        );

        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.orphans).toContain('orphan-store');
      });
    });

    describe('dry run mode', () => {
      it('does not create stores in dry run mode', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        await defService.addDefinition({
          type: 'file',
          name: 'dry-run-store',
          path: './docs',
        });

        const result = await handleStoresSync({ dryRun: true }, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.dryRun).toBe(true);
        expect(response.wouldCreate).toContain('dry-run-store');

        // Store should NOT exist
        const store = await storeService.getByName('dry-run-store');
        expect(store).toBeUndefined();
      });
    });

    describe('prune mode', () => {
      it('removes orphan stores when prune is true', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Create orphan store
        await storeService.create(
          {
            name: 'to-prune',
            type: 'file',
            path: docsDir,
          },
          { skipDefinitionSync: true }
        );

        const result = await handleStoresSync({ prune: true }, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.pruned).toContain('to-prune');

        // Store should be deleted
        const store = await storeService.getByName('to-prune');
        expect(store).toBeUndefined();
      });

      it('does not prune in dry run mode', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        await storeService.create(
          {
            name: 'keep-me',
            type: 'file',
            path: docsDir,
          },
          { skipDefinitionSync: true }
        );

        const result = await handleStoresSync({ prune: true, dryRun: true }, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.wouldPrune).toContain('keep-me');

        // Store should still exist
        const store = await storeService.getByName('keep-me');
        expect(store).toBeDefined();
      });
    });

    describe('error handling', () => {
      it('continues on error and reports failures', async () => {
        // Add definition for non-existent directory
        await defService.addDefinition({
          type: 'file',
          name: 'bad-store',
          path: './nonexistent',
        });

        // Also add a valid definition
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });
        await defService.addDefinition({
          type: 'file',
          name: 'good-store',
          path: './docs',
        });

        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        // Should have one failure and one success
        expect(response.failed).toHaveLength(1);
        expect(response.failed[0].name).toBe('bad-store');
        expect(response.failed[0].error).toBeDefined();
        expect(response.created).toContain('good-store');
      });
    });

    describe('empty config', () => {
      it('handles empty definitions gracefully', async () => {
        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.created).toHaveLength(0);
        expect(response.skipped).toHaveLength(0);
        expect(response.failed).toHaveLength(0);
        expect(response.orphans).toHaveLength(0);
      });
    });

    describe('reindex mode', () => {
      it('reports wouldReindex in dry run mode', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Create store (auto-adds definition)
        await storeService.create({
          name: 'existing-store',
          type: 'file',
          path: docsDir,
        });

        const result = await handleStoresSync({ reindex: true, dryRun: true }, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.dryRun).toBe(true);
        expect(response.wouldReindex).toContain('existing-store');
        expect(response.reindexJobs).toBeUndefined();
      });

      it('starts reindex jobs for existing stores', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        // Create store (auto-adds definition)
        await storeService.create({
          name: 'reindex-store',
          type: 'file',
          path: docsDir,
        });

        const result = await handleStoresSync({ reindex: true }, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.reindexJobs).toHaveLength(1);
        expect(response.reindexJobs[0].store).toBe('reindex-store');
        expect(response.reindexJobs[0].jobId).toMatch(/^job_/);
      });

      it('does not reindex if reindex flag is not set', async () => {
        const docsDir = join(projectRoot, 'docs');
        await mkdir(docsDir, { recursive: true });

        await storeService.create({
          name: 'no-reindex-store',
          type: 'file',
          path: docsDir,
        });

        const result = await handleStoresSync({}, context);
        const response = JSON.parse(result.content[0].text);

        expect(response.reindexJobs).toBeUndefined();
        expect(response.wouldReindex).toBeUndefined();
      });
    });
  });
});
