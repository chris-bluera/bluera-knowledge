import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { createServices, destroyServices } from '../../services/index.js';
import type { StoreType } from '../../types/store.js';
import type { GlobalOptions } from '../program.js';

export function createStoreCommand(getOptions: () => GlobalOptions): Command {
  const store = new Command('store').description(
    'Manage knowledge stores (collections of indexed documents)'
  );

  store
    .command('list')
    .description('Show all stores with their type (file/repo/web) and ID')
    .option('-t, --type <type>', 'Filter by type: file, repo, or web')
    .action(async (options: { type?: StoreType }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      try {
        const stores = await services.store.list(options.type);

        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(stores, null, 2));
        } else if (globalOpts.quiet === true) {
          // Quiet mode: just list store names, one per line
          for (const s of stores) {
            console.log(s.name);
          }
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
      } finally {
        await destroyServices(services);
      }
    });

  store
    .command('create <name>')
    .description('Create a new store pointing to a local path or URL')
    .requiredOption(
      '-t, --type <type>',
      'Store type: file (local dir), repo (git), web (crawled site)'
    )
    .requiredOption('-s, --source <path>', 'Local path for file/repo stores, URL for web stores')
    .option('-d, --description <desc>', 'Optional description for the store')
    .option('--tags <tags>', 'Comma-separated tags for filtering')
    .action(
      async (
        name: string,
        options: {
          type: StoreType;
          source: string;
          description?: string;
          tags?: string;
        }
      ) => {
        const globalOpts = getOptions();
        const services = await createServices(globalOpts.config, globalOpts.dataDir);
        let exitCode = 0;
        try {
          // Detect if source is a URL (for repo stores that should clone from remote)
          const isUrl =
            options.source.startsWith('http://') || options.source.startsWith('https://');
          const result = await services.store.create({
            name,
            type: options.type,
            path:
              options.type === 'file' || (options.type === 'repo' && !isUrl)
                ? options.source
                : undefined,
            url:
              options.type === 'web' || (options.type === 'repo' && isUrl)
                ? options.source
                : undefined,
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
            exitCode = 1;
          }
        } finally {
          await destroyServices(services);
        }
        if (exitCode !== 0) {
          // Set exit code and let Node.js exit naturally after event loop drains
          // Using process.exit() causes mutex crashes from native code (LanceDB, tree-sitter)
          process.exitCode = exitCode;
        }
      }
    );

  store
    .command('info <store>')
    .description('Show store details: ID, type, path/URL, timestamps')
    .action(async (storeIdOrName: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      let exitCode = 0;
      storeInfo: try {
        const s = await services.store.getByIdOrName(storeIdOrName);

        if (s === undefined) {
          console.error(`Error: Store not found: ${storeIdOrName}`);
          exitCode = 3;
          break storeInfo;
        }

        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(s, null, 2));
        } else {
          console.log(`\nStore: ${s.name}`);
          console.log(`  ID: ${s.id}`);
          console.log(`  Type: ${s.type}`);
          if ('path' in s) console.log(`  Path: ${s.path}`);
          if ('url' in s && s.url !== undefined) console.log(`  URL: ${s.url}`);
          if (s.description !== undefined) console.log(`  Description: ${s.description}`);
          console.log(`  Created: ${s.createdAt.toISOString()}`);
          console.log(`  Updated: ${s.updatedAt.toISOString()}`);
          console.log('');
        }
      } finally {
        await destroyServices(services);
      }
      if (exitCode !== 0) {
        // Set exit code and let Node.js exit naturally after event loop drains
        // Using process.exit() causes mutex crashes from native code (LanceDB, tree-sitter)
        process.exitCode = exitCode;
      }
    });

  store
    .command('delete <store>')
    .description('Remove store and its indexed documents from LanceDB')
    .option('-f, --force', 'Delete without confirmation prompt')
    .option('-y, --yes', 'Alias for --force')
    .action(async (storeIdOrName: string, options: { force?: boolean; yes?: boolean }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      let exitCode = 0;
      storeDelete: try {
        const s = await services.store.getByIdOrName(storeIdOrName);

        if (s === undefined) {
          console.error(`Error: Store not found: ${storeIdOrName}`);
          exitCode = 3;
          break storeDelete;
        }

        // Require --force or -y in non-TTY mode, prompt in TTY mode
        const skipConfirmation = options.force === true || options.yes === true;
        if (!skipConfirmation) {
          if (!process.stdin.isTTY) {
            console.error(
              'Error: Use --force or -y to delete without confirmation in non-interactive mode'
            );
            exitCode = 1;
            break storeDelete;
          }
          // Interactive confirmation
          const readline = await import('node:readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Delete store "${s.name}"? [y/N] `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('Cancelled.');
            // exitCode stays 0 for user-initiated cancellation
            break storeDelete;
          }
        }

        // Delete LanceDB table first (so searches don't return results for deleted store)
        await services.lance.deleteStore(s.id);

        // Delete code graph file
        await services.codeGraph.deleteGraph(s.id);

        // For repo stores cloned from URL, remove the cloned directory
        if (s.type === 'repo' && 'url' in s && s.url !== undefined) {
          const dataDir = services.config.resolveDataDir();
          const repoPath = join(dataDir, 'repos', s.id);
          await rm(repoPath, { recursive: true, force: true });
        }

        // Delete from registry last
        const result = await services.store.delete(s.id);

        if (result.success) {
          console.log(`Deleted store: ${s.name}`);
        } else {
          console.error(`Error: ${result.error.message}`);
          exitCode = 1;
        }
      } finally {
        await destroyServices(services);
      }
      if (exitCode !== 0) {
        // Set exit code and let Node.js exit naturally after event loop drains
        // Using process.exit() causes mutex crashes from native code (LanceDB, tree-sitter)
        process.exitCode = exitCode;
      }
    });

  return store;
}
