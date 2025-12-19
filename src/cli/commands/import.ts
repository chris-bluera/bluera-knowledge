import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import ora, { type Ora } from 'ora';
import { createServices } from '../../services/index.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document, DocumentMetadata } from '../../types/document.js';
import type { StoreType } from '../../types/store.js';

interface ImportedDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

interface ImportData {
  store: {
    type: StoreType;
    path?: string;
    url?: string;
    description?: string;
    tags?: string[];
    branch?: string;
    depth?: number;
  };
  documents: ImportedDocument[];
}

export function createImportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('import')
    .description('Load exported JSON, re-embed documents, create new store')
    .argument('<path>', 'Import file path')
    .argument('<name>', 'Name for the new store')
    .action(async (path: string, storeName: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      // Use spinner in interactive mode, simple output otherwise
      const isInteractive = process.stdout.isTTY === true && globalOpts.quiet !== true;
      let spinner: Ora | undefined;

      const updateStatus = (text: string): void => {
        if (spinner !== undefined) {
          spinner.text = text;
        } else if (globalOpts.quiet !== true && globalOpts.format !== 'json') {
          console.log(text);
        }
      };

      const failStatus = (text: string): void => {
        if (spinner !== undefined) {
          spinner.fail(text);
        } else if (globalOpts.format !== 'json') {
          console.error(text);
        }
      };

      // Read and parse the export file
      if (isInteractive) {
        spinner = ora('Reading import file...').start();
      }
      let data: ImportData;
      try {
        const content = await readFile(path, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        // Validate structure
        if (
          typeof parsed !== 'object' ||
          parsed === null ||
          !('store' in parsed) ||
          !('documents' in parsed) ||
          !Array.isArray((parsed as { documents: unknown }).documents)
        ) {
          throw new Error('Invalid format');
        }
        data = parsed as ImportData;
      } catch (error) {
        failStatus('Failed to read import file');
        if (error instanceof Error) {
          if (error.message.includes('ENOENT')) {
            console.error(`Error: File not found: ${path}`);
          } else if (error.message.includes('JSON') || error.message === 'Invalid format') {
            console.error('Error: Invalid JSON format in import file');
          } else {
            console.error(`Error: ${error.message}`);
          }
        } else {
          console.error('Error: Unknown error reading file');
        }
        process.exit(1);
      }

      // Create new store with imported data (using store type/path/url from export)
      updateStatus('Creating store...');
      const result = await services.store.create({
        name: storeName,
        type: data.store.type,
        path: data.store.path,
        url: data.store.url,
        description: data.store.description ?? `Imported from ${path}`,
        tags: data.store.tags,
        branch: data.store.branch,
        depth: data.store.depth,
      });

      if (!result.success) {
        failStatus('Failed to create store');
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }

      const store = result.data;
      await services.lance.initialize(store.id);

      // Re-embed documents using the embeddings service
      try {
        updateStatus(`Re-embedding ${String(data.documents.length)} documents...`);
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
          updateStatus(`Re-embedding documents... (${String(processed)}/${String(data.documents.length)})`);
        }

        // Add documents to LanceStore with updated store ID
        if (documents.length > 0) {
          updateStatus('Adding documents to store...');
          await services.lance.addDocuments(store.id, documents);
        }

        const importResult = {
          success: true,
          store: storeName,
          storeId: store.id,
          documentsImported: data.documents.length,
        };

        if (globalOpts.format === 'json') {
          if (spinner !== undefined) spinner.stop();
          console.log(JSON.stringify(importResult, null, 2));
        } else if (spinner !== undefined) {
          spinner.succeed(`Imported ${String(data.documents.length)} documents as "${storeName}"`);
        } else if (globalOpts.quiet !== true) {
          console.log(`Imported ${String(data.documents.length)} documents as "${storeName}"`);
        }
      } catch (error) {
        failStatus('Failed to import documents');
        if (error instanceof Error) {
          console.error(`Error: ${error.message}`);
        } else {
          console.error('Error: Unknown error during import');
        }
        console.error('Note: Store was created but documents may not have been imported');
        process.exit(1);
      }
    });
}
