import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import ora from 'ora';
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
      const spinner = ora('Reading import file...').start();
      let data: any;
      try {
        const content = await readFile(path, 'utf-8');
        data = JSON.parse(content);
      } catch (error) {
        spinner.fail('Failed to read import file');
        if (error instanceof Error) {
          if (error.message.includes('ENOENT')) {
            console.error(`Error: File not found: ${path}`);
          } else if (error.message.includes('JSON')) {
            console.error('Error: Invalid JSON format in import file');
          } else {
            console.error(`Error: ${error.message}`);
          }
        } else {
          console.error('Error: Unknown error reading file');
        }
        process.exit(1);
      }

      // Validate required fields
      if (!data.store || !Array.isArray(data.documents)) {
        spinner.fail('Invalid import file format');
        console.error('Error: Import file must contain "store" and "documents" fields');
        process.exit(1);
      }

      // Create new store with imported data (using store type/path/url from export)
      spinner.text = 'Creating store...';
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
        spinner.fail('Failed to create store');
        console.error('Error:', result.error.message);
        process.exit(1);
      }

      const store = result.data;
      await services.lance.initialize(store.id);

      // Re-embed documents using the embeddings service
      try {
        spinner.text = `Re-embedding ${data.documents.length} documents...`;
        const documents: Document[] = [];
        let processed = 0;

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

          processed++;
          spinner.text = `Re-embedding documents... (${processed}/${data.documents.length})`;
        }

        // Add documents to LanceStore with updated store ID
        if (documents.length > 0) {
          spinner.text = 'Adding documents to store...';
          await services.lance.addDocuments(store.id, documents);
        }

        spinner.succeed(`Imported ${data.documents.length} documents as "${options.name}"`);
      } catch (error) {
        spinner.fail('Failed to import documents');
        if (error instanceof Error) {
          console.error('Error:', error.message);
        } else {
          console.error('Error: Unknown error during import');
        }
        console.error('Note: Store was created but documents may not have been imported');
        process.exit(1);
      }
    });
}
