import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';

export function createExportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('export')
    .description('Dump store documents + metadata to JSON file for backup/transfer')
    .argument('<store>', 'Store ID or name')
    .argument('<output>', 'Output file path')
    .action(async (storeIdOrName: string, outputPath: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (!store) {
        console.error(`Error: Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      await services.lance.initialize(store.id);

      // Get all documents by doing a search with empty vector
      const dummyVector: number[] = new Array<number>(384).fill(0);
      const docs = await services.lance.search(store.id, dummyVector, 10000);

      const exportData = {
        version: 1,
        store,
        documents: docs,
        exportedAt: new Date().toISOString(),
      };

      await writeFile(outputPath, JSON.stringify(exportData, null, 2));

      const result = {
        success: true,
        store: store.name,
        documentsExported: docs.length,
        outputPath,
      };

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else if (globalOpts.quiet !== true) {
        console.log(`Exported ${String(docs.length)} documents to ${outputPath}`);
      }
    });
}
