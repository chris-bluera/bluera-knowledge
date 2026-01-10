import { Command } from 'commander';
import {
  handleAddRepo,
  handleAddFolder,
  handleStores,
  handleSuggest,
} from '../../plugin/commands.js';
import type { GlobalOptions } from '../program.js';

/**
 * CLI commands that mirror the plugin API for consistency.
 * These commands provide a simpler interface that matches the plugin commands.
 */

export function createAddRepoCommand(getOptions: () => GlobalOptions): Command {
  return new Command('add-repo')
    .description('Clone and index a library source repository')
    .argument('<url>', 'Git repository URL')
    .option('--name <name>', 'Store name (defaults to repo name)')
    .option('--branch <branch>', 'Git branch to clone')
    .action(async (url: string, options: { name?: string; branch?: string }) => {
      const globalOpts = getOptions();
      await handleAddRepo(
        { url, ...options },
        {
          config: globalOpts.config,
          dataDir: globalOpts.dataDir,
          projectRoot: globalOpts.projectRoot,
          format: globalOpts.format,
          quiet: globalOpts.quiet,
        }
      );
    });
}

export function createAddFolderCommand(getOptions: () => GlobalOptions): Command {
  return new Command('add-folder')
    .description('Index a local folder of reference material')
    .argument('<path>', 'Folder path to index')
    .option('--name <name>', 'Store name (defaults to folder name)')
    .action(async (path: string, options: { name?: string }) => {
      const globalOpts = getOptions();
      await handleAddFolder(
        { path, ...options },
        {
          config: globalOpts.config,
          dataDir: globalOpts.dataDir,
          projectRoot: globalOpts.projectRoot,
          format: globalOpts.format,
          quiet: globalOpts.quiet,
        }
      );
    });
}

export function createStoresCommand(getOptions: () => GlobalOptions): Command {
  return new Command('stores').description('List all indexed library stores').action(async () => {
    const globalOpts = getOptions();
    await handleStores({
      config: globalOpts.config,
      dataDir: globalOpts.dataDir,
      projectRoot: globalOpts.projectRoot,
      format: globalOpts.format,
      quiet: globalOpts.quiet,
    });
  });
}

export function createSuggestCommand(getOptions: () => GlobalOptions): Command {
  return new Command('suggest')
    .description('Suggest important dependencies to add to knowledge stores')
    .action(async () => {
      const globalOpts = getOptions();
      await handleSuggest({
        config: globalOpts.config,
        dataDir: globalOpts.dataDir,
        projectRoot: globalOpts.projectRoot,
        format: globalOpts.format,
        quiet: globalOpts.quiet,
      });
    });
}
