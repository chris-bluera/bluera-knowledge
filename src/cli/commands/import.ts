import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { createServices } from '../../services/index.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document } from '../../types/document.js';

export function createImportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('import')
    .description('Import store from file')
    .argument('<path>', 'Import file path')
    .requiredOption('-n, --name <name>', 'New store name')
    .action(async (path: string, options: { name: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      // Read and parse the export file
      const content = await readFile(path, 'utf-8');
      const data = JSON.parse(content);

      // Create new store with imported data (using store type/path/url from export)
      const result = await services.store.create({
        name: options.name,
        type: data.store.type,
        path: data.store.path,
        url: data.store.url,
        description: data.store.description || `Imported from ${path}`,
        tags: data.store.tags,
        branch: data.store.branch,
        depth: data.store.depth,
      });

      if (!result.success) {
        console.error('Failed to create store:', result.error.message);
        process.exit(1);
      }

      const store = result.data;
      await services.lance.initialize(store.id);

      // Re-embed documents using the embeddings service
      const documents: Document[] = [];
      for (const doc of data.documents) {
        // Re-embed the content
        const vector = await services.embeddings.embed(doc.content);

        // Create document with updated store ID in metadata
        documents.push({
          id: createDocumentId(doc.id),
          content: doc.content,
          vector,
          metadata: {
            ...doc.metadata,
            storeId: store.id,
            indexedAt: new Date(),
          },
        });
      }

      // Add documents to LanceStore with updated store ID
      if (documents.length > 0) {
        await services.lance.addDocuments(store.id, documents);
      }

      console.log(`Imported ${data.documents.length} documents as "${options.name}"`);
    });
}
