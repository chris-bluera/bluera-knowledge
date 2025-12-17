import { Command } from 'commander';
import { createHash } from 'node:crypto';
import ora from 'ora';
import { createServices } from '../../services/index.js';
import { PythonBridge } from '../../crawl/bridge.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document } from '../../types/document.js';

export function createCrawlCommand(getOptions: () => GlobalOptions): Command {
  return new Command('crawl')
    .description('Crawl a URL and add to store')
    .argument('<url>', 'URL to crawl')
    .requiredOption('-s, --store <store>', 'Target store ID/name')
    .action(async (url: string, options: { store: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(options.store);
      if (!store || store.type !== 'web') {
        console.error('Web store not found:', options.store);
        process.exit(3);
      }

      const spinner = ora(`Crawling ${url}`).start();
      const bridge = new PythonBridge();

      try {
        const result = await bridge.crawl(url);
        spinner.text = 'Indexing crawled content...';

        await services.lance.initialize(store.id);

        const docs: Document[] = [];
        for (const page of result.pages) {
          const vector = await services.embeddings.embed(page.content);
          docs.push({
            id: createDocumentId(`${store.id}-${createHash('md5').update(page.url).digest('hex')}`),
            content: page.content,
            vector,
            metadata: {
              type: 'web',
              storeId: store.id,
              url: page.url,
              indexedAt: new Date(),
            },
          });
        }

        await services.lance.addDocuments(store.id, docs);
        spinner.succeed(`Crawled and indexed ${result.pages.length} pages`);
      } catch (error) {
        spinner.fail(`Crawl failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(6);
      } finally {
        await bridge.stop();
      }
    });
}
