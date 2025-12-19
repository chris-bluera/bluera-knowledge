import { Command } from 'commander';
import { createHash } from 'node:crypto';
import ora, { type Ora } from 'ora';
import { createServices } from '../../services/index.js';
import { PythonBridge } from '../../crawl/bridge.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document } from '../../types/document.js';

export function createCrawlCommand(getOptions: () => GlobalOptions): Command {
  return new Command('crawl')
    .description('Fetch web pages via Python crawler, convert to text, index into store')
    .argument('<url>', 'URL to crawl')
    .argument('<store>', 'Target web store to add crawled content to')
    .action(async (url: string, storeIdOrName: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (!store || store.type !== 'web') {
        console.error(`Error: Web store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      // Use spinner in interactive mode (not quiet, not json output)
      const isInteractive = process.stdout.isTTY === true && globalOpts.quiet !== true && globalOpts.format !== 'json';
      let spinner: Ora | undefined;

      if (isInteractive) {
        spinner = ora(`Crawling ${url}`).start();
      } else if (globalOpts.quiet !== true && globalOpts.format !== 'json') {
        console.log(`Crawling ${url}`);
      }

      const bridge = new PythonBridge();

      try {
        const result = await bridge.crawl(url);
        if (spinner) {
          spinner.text = 'Indexing crawled content...';
        }

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

        const crawlResult = {
          success: true,
          store: store.name,
          url,
          pagesCrawled: result.pages.length,
        };

        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(crawlResult, null, 2));
        } else if (spinner !== undefined) {
          spinner.succeed(`Crawled and indexed ${String(result.pages.length)} pages`);
        } else if (globalOpts.quiet !== true) {
          console.log(`Crawled and indexed ${String(result.pages.length)} pages`);
        }
      } catch (error) {
        const message = `Crawl failed: ${error instanceof Error ? error.message : String(error)}`;
        if (spinner) {
          spinner.fail(message);
        } else {
          console.error(`Error: ${message}`);
        }
        process.exit(6);
      } finally {
        await bridge.stop();
      }
    });
}
