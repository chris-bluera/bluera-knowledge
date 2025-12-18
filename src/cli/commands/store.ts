import { Command } from 'commander';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';
import type { StoreType } from '../../types/store.js';

export function createStoreCommand(getOptions: () => GlobalOptions): Command {
  const store = new Command('store').description('Manage knowledge stores (collections of indexed documents)');

  store
    .command('list')
    .description('Show all stores with their type (file/repo/web) and ID')
    .option('-t, --type <type>', 'Filter by type: file, repo, or web')
    .action(async (options: { type?: StoreType }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const stores = await services.store.list(options.type);

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(stores, null, 2));
      } else {
        if (stores.length === 0) {
          console.log('No stores found.');
        } else {
          console.log('\nStores:\n');
          for (const s of stores) {
            console.log(`  ${s.name} (${s.type}) - ${s.id}`);
          }
          console.log('');
        }
      }
    });

  store
    .command('create <name>')
    .description('Create a new store pointing to a local path or URL')
    .requiredOption('-t, --type <type>', 'Store type: file (local dir), repo (git), web (crawled site)')
    .requiredOption('-s, --source <path>', 'Local path for file/repo stores, URL for web stores')
    .option('-d, --description <desc>', 'Optional description for the store')
    .option('--tags <tags>', 'Comma-separated tags for filtering')
    .action(async (name: string, options: {
      type: StoreType;
      source: string;
      description?: string;
      tags?: string;
    }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const result = await services.store.create({
        name,
        type: options.type,
        path: options.type !== 'web' ? options.source : undefined,
        url: options.type === 'web' ? options.source : undefined,
        description: options.description,
        tags: options.tags?.split(',').map((t) => t.trim()),
      });

      if (result.success) {
        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(`\nCreated store: ${result.data.name} (${result.data.id})\n`);
        }
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
    });

  store
    .command('info <store>')
    .description('Show store details: ID, type, path/URL, timestamps')
    .action(async (storeIdOrName: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const s = await services.store.getByIdOrName(storeIdOrName);

      if (s === undefined) {
        console.error(`Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(s, null, 2));
      } else {
        console.log(`\nStore: ${s.name}`);
        console.log(`  ID: ${s.id}`);
        console.log(`  Type: ${s.type}`);
        if ('path' in s) console.log(`  Path: ${s.path}`);
        if ('url' in s) console.log(`  URL: ${s.url}`);
        if (s.description !== undefined) console.log(`  Description: ${s.description}`);
        console.log(`  Created: ${s.createdAt.toISOString()}`);
        console.log(`  Updated: ${s.updatedAt.toISOString()}`);
        console.log('');
      }
    });

  store
    .command('delete <store>')
    .description('Remove store and its indexed documents from LanceDB')
    .option('-f, --force', 'Delete without confirmation prompt')
    .action(async (storeIdOrName: string, options: { force?: boolean }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const s = await services.store.getByIdOrName(storeIdOrName);

      if (s === undefined) {
        console.error(`Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      const result = await services.store.delete(s.id);

      if (result.success) {
        console.log(`Deleted store: ${s.name}`);
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
    });

  return store;
}
