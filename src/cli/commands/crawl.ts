import { Command } from 'commander';
import { createHash } from 'node:crypto';
import ora, { type Ora } from 'ora';
import { createServices } from '../../services/index.js';
import { IntelligentCrawler, type CrawlProgress } from '../../crawl/intelligent-crawler.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document } from '../../types/document.js';

export function createCrawlCommand(getOptions: () => GlobalOptions): Command {
  return new Command('crawl')
    .description('Crawl web pages with natural language control and index into store')
    .argument('<url>', 'URL to crawl')
    .argument('<store>', 'Target web store to add crawled content to')
    .option('--crawl <instruction>', 'Natural language instruction for what to crawl (e.g., "all Getting Started pages")')
    .option('--extract <instruction>', 'Natural language instruction for what to extract (e.g., "extract API references")')
    .option('--simple', 'Use simple BFS mode instead of intelligent crawling')
    .option('--max-pages <number>', 'Maximum number of pages to crawl', '50')
    .option('--headless', 'Use headless browser for JavaScript-rendered sites')
    .action(async (url: string, storeIdOrName: string, cmdOptions: {
      crawl?: string;
      extract?: string;
      simple?: boolean;
      maxPages?: string;
      headless?: boolean;
    }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (!store || store.type !== 'web') {
        console.error(`Error: Web store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      const maxPages = cmdOptions.maxPages !== undefined ? parseInt(cmdOptions.maxPages) : 50;

      // Use spinner in interactive mode
      const isInteractive = process.stdout.isTTY && globalOpts.quiet !== true && globalOpts.format !== 'json';
      let spinner: Ora | undefined;

      if (isInteractive) {
        const mode = cmdOptions.simple === true ? 'simple' : 'intelligent';
        spinner = ora(`Crawling ${url} (${mode} mode)`).start();
      } else if (globalOpts.quiet !== true && globalOpts.format !== 'json') {
        console.log(`Crawling ${url}`);
      }

      const crawler = new IntelligentCrawler();
      let pagesIndexed = 0;

      // Listen for progress events
      crawler.on('progress', (progress: CrawlProgress) => {
        if (spinner) {
          if (progress.type === 'strategy') {
            spinner.text = progress.message !== undefined ? progress.message : 'Analyzing crawl strategy...';
          } else if (progress.type === 'page') {
            const url = progress.currentUrl !== undefined ? progress.currentUrl : 'unknown';
            spinner.text = `Crawling ${String(progress.pagesVisited + 1)}/${String(maxPages)} - ${url}`;
          } else if (progress.type === 'extraction') {
            const url = progress.currentUrl !== undefined ? progress.currentUrl : 'unknown';
            spinner.text = `Extracting from ${url}...`;
          } else if (progress.type === 'error' && progress.message !== undefined) {
            spinner.warn(progress.message);
          }
        }
      });

      try {
        await services.lance.initialize(store.id);
        const docs: Document[] = [];

        // Crawl pages using IntelligentCrawler
        for await (const result of crawler.crawl(url, {
          ...(cmdOptions.crawl !== undefined && { crawlInstruction: cmdOptions.crawl }),
          ...(cmdOptions.extract !== undefined && { extractInstruction: cmdOptions.extract }),
          maxPages,
          ...(cmdOptions.simple !== undefined && { simple: cmdOptions.simple }),
          useHeadless: cmdOptions.headless ?? false,
        })) {
          // Embed and index the content (use extracted if available, otherwise markdown)
          const contentToEmbed = result.extracted !== undefined ? result.extracted : result.markdown;
          const vector = await services.embeddings.embed(contentToEmbed);

          docs.push({
            id: createDocumentId(`${store.id}-${createHash('md5').update(result.url).digest('hex')}`),
            content: contentToEmbed,
            vector,
            metadata: {
              type: 'web',
              storeId: store.id,
              url: result.url,
              title: result.title,
              extracted: result.extracted !== undefined,
              depth: result.depth,
              indexedAt: new Date(),
            },
          });

          pagesIndexed++;
        }

        // Index all documents
        if (docs.length > 0) {
          if (spinner) {
            spinner.text = 'Indexing documents...';
          }
          await services.lance.addDocuments(store.id, docs);
        }

        const crawlResult = {
          success: true,
          store: store.name,
          url,
          pagesCrawled: pagesIndexed,
          mode: cmdOptions.simple === true ? 'simple' : 'intelligent',
          hadCrawlInstruction: cmdOptions.crawl !== undefined,
          hadExtractInstruction: cmdOptions.extract !== undefined,
        };

        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(crawlResult, null, 2));
        } else if (spinner !== undefined) {
          spinner.succeed(`Crawled and indexed ${String(pagesIndexed)} pages`);
        } else if (globalOpts.quiet !== true) {
          console.log(`Crawled and indexed ${String(pagesIndexed)} pages`);
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
        await crawler.stop();
      }
    });
}
