import { Command } from 'commander';
import { createServices, destroyServices } from '../../services/index.js';
import { JobService } from '../../services/job.service.js';
import { StoreDefinitionService } from '../../services/store-definition.service.js';
import {
  isFileStoreDefinition,
  isRepoStoreDefinition,
  isWebStoreDefinition,
} from '../../types/store-definition.js';
import { spawnBackgroundWorker } from '../../workers/spawn-worker.js';
import type { StoreService } from '../../services/store.service.js';
import type { StoreDefinition } from '../../types/store-definition.js';
import type { GlobalOptions } from '../program.js';

interface SyncResult {
  created: string[];
  skipped: string[];
  failed: Array<{ name: string; error: string }>;
  orphans: string[];
  pruned: string[];
  dryRun: boolean;
  wouldCreate: string[];
  wouldPrune: string[];
  reindexJobs: Array<{ store: string; jobId: string }>;
  wouldReindex: string[];
}

/**
 * Create a store from a definition
 */
async function createStoreFromDefinition(
  def: StoreDefinition,
  defService: StoreDefinitionService,
  storeService: StoreService
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    if (isFileStoreDefinition(def)) {
      const resolvedPath = defService.resolvePath(def.path);
      const createResult = await storeService.create(
        {
          name: def.name,
          type: 'file',
          path: resolvedPath,
          description: def.description,
          tags: def.tags,
        },
        { skipDefinitionSync: true }
      );
      if (!createResult.success) {
        return { success: false, error: createResult.error.message };
      }
      return { success: true };
    }

    if (isRepoStoreDefinition(def)) {
      const createResult = await storeService.create(
        {
          name: def.name,
          type: 'repo',
          url: def.url,
          branch: def.branch,
          depth: def.depth,
          description: def.description,
          tags: def.tags,
        },
        { skipDefinitionSync: true }
      );
      if (!createResult.success) {
        return { success: false, error: createResult.error.message };
      }
      return { success: true };
    }

    if (isWebStoreDefinition(def)) {
      const createResult = await storeService.create(
        {
          name: def.name,
          type: 'web',
          url: def.url,
          depth: def.depth,
          description: def.description,
          tags: def.tags,
        },
        { skipDefinitionSync: true }
      );
      if (!createResult.success) {
        return { success: false, error: createResult.error.message };
      }
      return { success: true };
    }

    return { success: false, error: 'Unknown store definition type' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createSyncCommand(getOptions: () => GlobalOptions): Command {
  const sync = new Command('sync').description(
    'Sync stores from definitions config (bootstrap on fresh clone)'
  );

  sync
    .option('--dry-run', 'Show what would happen without making changes')
    .option('--prune', 'Remove stores not in definitions')
    .option('--reindex', 'Re-index existing stores after sync')
    .action(async (options: { dryRun?: boolean; prune?: boolean; reindex?: boolean }) => {
      const globalOpts = getOptions();
      const projectRoot = globalOpts.projectRoot ?? process.cwd();

      const defService = new StoreDefinitionService(projectRoot);
      const services = await createServices(globalOpts.config, globalOpts.dataDir, projectRoot);

      try {
        const config = await defService.load();
        const existingStores = await services.store.list();
        const existingNames = new Set(existingStores.map((s) => s.name));
        const definedNames = new Set(config.stores.map((d) => d.name));

        const result: SyncResult = {
          created: [],
          skipped: [],
          failed: [],
          orphans: [],
          pruned: [],
          dryRun: options.dryRun === true,
          wouldCreate: [],
          wouldPrune: [],
          reindexJobs: [],
          wouldReindex: [],
        };

        // Process each definition
        for (const def of config.stores) {
          if (existingNames.has(def.name)) {
            result.skipped.push(def.name);
            continue;
          }

          if (options.dryRun === true) {
            result.wouldCreate.push(def.name);
            continue;
          }

          const createResult = await createStoreFromDefinition(def, defService, services.store);
          if (createResult.success) {
            result.created.push(def.name);
          } else {
            result.failed.push({ name: def.name, error: createResult.error });
          }
        }

        // Find orphans
        for (const store of existingStores) {
          if (!definedNames.has(store.name)) {
            result.orphans.push(store.name);
          }
        }

        // Prune orphans if requested
        if (options.prune === true && result.orphans.length > 0) {
          if (options.dryRun === true) {
            result.wouldPrune = [...result.orphans];
          } else {
            for (const orphanName of result.orphans) {
              const store = await services.store.getByName(orphanName);
              if (store !== undefined) {
                const deleteResult = await services.store.delete(store.id, {
                  skipDefinitionSync: true,
                });
                if (deleteResult.success) {
                  result.pruned.push(orphanName);
                }
              }
            }
          }
        }

        // Re-index existing stores if requested
        if (options.reindex === true && result.skipped.length > 0) {
          if (options.dryRun === true) {
            result.wouldReindex = [...result.skipped];
          } else {
            const dataDir = globalOpts.dataDir ?? services.config.resolveDataDir();
            const jobService = new JobService(dataDir);

            for (const storeName of result.skipped) {
              const store = await services.store.getByName(storeName);
              if (store !== undefined) {
                const job = jobService.createJob({
                  type: 'index',
                  details: { storeId: store.id, storeName: store.name },
                  message: `Re-indexing ${storeName}...`,
                });
                spawnBackgroundWorker(job.id, dataDir);
                result.reindexJobs.push({ store: storeName, jobId: job.id });
              }
            }
          }
        }

        // Output result
        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printHumanReadable(result, globalOpts.quiet === true);
        }
      } finally {
        await destroyServices(services);
      }
    });

  return sync;
}

function printHumanReadable(result: SyncResult, quiet: boolean): void {
  if (quiet) {
    // Just print created/pruned/reindexed store names
    for (const name of result.created) {
      console.log(`created: ${name}`);
    }
    for (const name of result.pruned) {
      console.log(`pruned: ${name}`);
    }
    for (const { store, jobId } of result.reindexJobs) {
      console.log(`reindexing: ${store} (${jobId})`);
    }
    for (const name of result.wouldCreate) {
      console.log(`would create: ${name}`);
    }
    for (const name of result.wouldPrune) {
      console.log(`would prune: ${name}`);
    }
    for (const name of result.wouldReindex) {
      console.log(`would reindex: ${name}`);
    }
    return;
  }

  if (result.dryRun) {
    console.log('\n[DRY RUN] No changes made.\n');
  } else {
    console.log('\nSync completed.\n');
  }

  if (result.created.length > 0) {
    console.log(`Created (${String(result.created.length)}):`);
    for (const name of result.created) {
      console.log(`  + ${name}`);
    }
  }

  if (result.wouldCreate.length > 0) {
    console.log(`Would create (${String(result.wouldCreate.length)}):`);
    for (const name of result.wouldCreate) {
      console.log(`  + ${name}`);
    }
  }

  if (result.skipped.length > 0) {
    console.log(`Skipped (already exist) (${String(result.skipped.length)}):`);
    for (const name of result.skipped) {
      console.log(`  - ${name}`);
    }
  }

  if (result.failed.length > 0) {
    console.log(`Failed (${String(result.failed.length)}):`);
    for (const { name, error } of result.failed) {
      console.log(`  ! ${name}: ${error}`);
    }
  }

  if (result.orphans.length > 0) {
    console.log(`Orphans (not in definitions) (${String(result.orphans.length)}):`);
    for (const name of result.orphans) {
      console.log(`  ? ${name}`);
    }
  }

  if (result.pruned.length > 0) {
    console.log(`Pruned (${String(result.pruned.length)}):`);
    for (const name of result.pruned) {
      console.log(`  x ${name}`);
    }
  }

  if (result.wouldPrune.length > 0) {
    console.log(`Would prune (${String(result.wouldPrune.length)}):`);
    for (const name of result.wouldPrune) {
      console.log(`  x ${name}`);
    }
  }

  if (result.reindexJobs.length > 0) {
    console.log(`Reindexing started (${String(result.reindexJobs.length)}):`);
    for (const { store, jobId } of result.reindexJobs) {
      console.log(`  ↻ ${store} (Job: ${jobId})`);
    }
  }

  if (result.wouldReindex.length > 0) {
    console.log(`Would reindex (${String(result.wouldReindex.length)}):`);
    for (const name of result.wouldReindex) {
      console.log(`  ↻ ${name}`);
    }
  }

  console.log('');
}
