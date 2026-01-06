import { Command } from 'commander';
import { createHash } from 'node:crypto';
import ora, { type Ora } from 'ora';
import { createServices, destroyServices } from '../../services/index.js';
import { IntelligentCrawler, type CrawlProgress } from '../../crawl/intelligent-crawler.js';
import { createDocumentId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';
import type { Document } from '../../types/document.js';
import type { WebStore } from '../../types/store.js';
import { ChunkingService } from '../../services/chunking.service.js';
import { classifyWebContentType } from '../../services/index.service.js';

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

      // Look up or auto-create web store
      let store: WebStore;
      let storeCreated = false;
      const existingStore = await services.store.getByIdOrName(storeIdOrName);

      if (!existingStore) {
        // Auto-create web store
        const result = await services.store.create({
          name: storeIdOrName,
          type: 'web',
          url,
        });
        if (!result.success) {
          await destroyServices(services);
          throw new Error(`Failed to create store: ${result.error.message}`);
        }
        // Type narrowing: success check above ensures result.data is Store
        // We know it's a WebStore because we created it with type: 'web'
        const createdStore = result.data;
        if (createdStore.type !== 'web') {
          throw new Error('Unexpected store type after creation');
        }
        store = createdStore;
        storeCreated = true;
        if (globalOpts.quiet !== true && globalOpts.format !== 'json') {
          console.log(`Created web store: ${store.name}`);
        }
      } else if (existingStore.type !== 'web') {
        await destroyServices(services);
        throw new Error(`Store "${storeIdOrName}" exists but is not a web store (type: ${existingStore.type})`);
      } else {
        store = existingStore;
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
      // Use web preset for larger prose-friendly chunks
      const webChunker = ChunkingService.forContentType('web');
      let pagesIndexed = 0;
      let chunksCreated = 0;

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
          // Use extracted content if available, otherwise markdown
          const contentToProcess = result.extracted !== undefined ? result.extracted : result.markdown;

          // Chunk the content using markdown-aware chunking (web content is converted to markdown)
          const chunks = webChunker.chunk(contentToProcess, `${result.url}.md`);
          const fileType = classifyWebContentType(result.url, result.title);
          const urlHash = createHash('md5').update(result.url).digest('hex');

          for (const chunk of chunks) {
            const chunkId = chunks.length > 1
              ? `${store.id}-${urlHash}-${String(chunk.chunkIndex)}`
              : `${store.id}-${urlHash}`;
            const vector = await services.embeddings.embed(chunk.content);

            docs.push({
              id: createDocumentId(chunkId),
              content: chunk.content,
              vector,
              metadata: {
                type: chunks.length > 1 ? 'chunk' : 'web',
                storeId: store.id,
                url: result.url,
                title: result.title,
                extracted: result.extracted !== undefined,
                depth: result.depth,
                indexedAt: new Date(),
                fileType,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                sectionHeader: chunk.sectionHeader,
              },
            });
            chunksCreated++;
          }

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
          storeCreated,
          url,
          pagesCrawled: pagesIndexed,
          chunksCreated,
          mode: cmdOptions.simple === true ? 'simple' : 'intelligent',
          hadCrawlInstruction: cmdOptions.crawl !== undefined,
          hadExtractInstruction: cmdOptions.extract !== undefined,
        };

        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(crawlResult, null, 2));
        } else if (spinner !== undefined) {
          spinner.succeed(`Crawled ${String(pagesIndexed)} pages, indexed ${String(chunksCreated)} chunks`);
        } else if (globalOpts.quiet !== true) {
          console.log(`Crawled ${String(pagesIndexed)} pages, indexed ${String(chunksCreated)} chunks`);
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
        await destroyServices(services);
      }
    });
}
