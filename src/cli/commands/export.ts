import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';

export function createExportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('export')
    .description('Export store to file')
    .argument('<store>', 'Store ID or name')
    .requiredOption('-o, --output <path>', 'Output file path')
    .action(async (storeIdOrName: string, options: { output: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (!store) {
        console.error('Store not found:', storeIdOrName);
        process.exit(3);
      }

      await services.lance.initialize(store.id);

      // Get all documents by doing a search with empty vector
      const dummyVector = new Array(384).fill(0);
      const docs = await services.lance.search(store.id, dummyVector, 10000);

      const exportData = {
        version: 1,
        store,
        documents: docs,
        exportedAt: new Date().toISOString(),
      };

      await writeFile(options.output, JSON.stringify(exportData, null, 2));
      console.log(`Exported ${docs.length} documents to ${options.output}`);
    });
}
