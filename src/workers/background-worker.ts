import { createHash } from 'node:crypto';
import { IntelligentCrawler, type CrawlProgress } from '../crawl/intelligent-crawler.js';
import { IndexService } from '../services/index.service.js';
import { JobService } from '../services/job.service.js';
import { StoreService } from '../services/store.service.js';
import { createStoreId, createDocumentId } from '../types/brands.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { LanceStore } from '../db/lance.js';
import type { Document } from '../types/document.js';
import type { Job } from '../types/job.js';

/**
 * Calculate index progress as a percentage, handling division by zero.
 * @param current - Current number of items processed
 * @param total - Total number of items (may be 0)
 * @param scale - Scale factor for progress (default 100 for 0-100%)
 * @returns Progress value, or 0 if total is 0
 */
export function calculateIndexProgress(
  current: number,
  total: number,
  scale: number = 100
): number {
  if (total === 0) return 0;
  return (current / total) * scale;
}

export class BackgroundWorker {
  constructor(
    private readonly jobService: JobService,
    private readonly storeService: StoreService,
    private readonly indexService: IndexService,
    private readonly lanceStore: LanceStore,
    private readonly embeddingEngine: EmbeddingEngine
  ) {}

  /**
   * Execute a job based on its type
   */
  async executeJob(jobId: string): Promise<void> {
    const job = this.jobService.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Update to running status
      this.jobService.updateJob(jobId, {
        status: 'running',
        message: `Starting ${job.type} operation...`,
        progress: 0,
        details: { startedAt: new Date().toISOString() },
      });

      // Execute based on job type
      switch (job.type) {
        case 'clone':
          await this.executeCloneJob(job);
          break;
        case 'index':
          await this.executeIndexJob(job);
          break;
        case 'crawl':
          await this.executeCrawlJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${String(job.type)}`);
      }

      // Mark as completed
      this.jobService.updateJob(jobId, {
        status: 'completed',
        progress: 100,
        message: `${job.type} operation completed successfully`,
        details: { completedAt: new Date().toISOString() },
      });
    } catch (error) {
      // Mark as failed
      const errorDetails: Record<string, unknown> = {
        completedAt: new Date().toISOString(),
      };
      if (error instanceof Error && error.stack !== undefined) {
        errorDetails['error'] = error.stack;
      } else {
        errorDetails['error'] = String(error);
      }
      this.jobService.updateJob(jobId, {
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: errorDetails,
      });
      throw error;
    }
  }

  /**
   * Execute a clone job (git clone + initial indexing)
   */
  private async executeCloneJob(job: Job): Promise<void> {
    const { storeId } = job.details;

    if (storeId === undefined || typeof storeId !== 'string') {
      throw new Error('Store ID required for clone job');
    }

    // Get the store
    const store = await this.storeService.get(createStoreId(storeId));
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    // Clone is already done by the time the job is created
    // (happens in StoreService.create), so we just need to index

    // Update progress - cloning considered done (30%)
    this.jobService.updateJob(job.id, {
      status: 'running',
      message: 'Repository cloned, starting indexing...',
      progress: 30,
    });

    // Index the repository with progress updates
    const result = await this.indexService.indexStore(
      store,
      (event: { type: string; current: number; total: number; message: string }) => {
        // Check if job was cancelled
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === 'cancelled') {
          throw new Error('Job cancelled by user');
        }

        // Indexing is 70% of total progress (30-100%)
        const indexProgress = calculateIndexProgress(event.current, event.total, 70);
        const totalProgress = 30 + indexProgress;

        this.jobService.updateJob(job.id, {
          message: `Indexed ${String(event.current)}/${String(event.total)} files`,
          progress: Math.min(99, totalProgress), // Cap at 99 until fully complete
          details: {
            filesProcessed: event.current,
            totalFiles: event.total,
          },
        });
      }
    );

    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Execute an index job (re-indexing existing store)
   */
  private async executeIndexJob(job: Job): Promise<void> {
    const { storeId } = job.details;

    if (storeId === undefined || typeof storeId !== 'string') {
      throw new Error('Store ID required for index job');
    }

    // Get the store
    const store = await this.storeService.getByIdOrName(createStoreId(storeId));
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }

    // Index with progress updates
    const result = await this.indexService.indexStore(
      store,
      (event: { type: string; current: number; total: number; message: string }) => {
        // Check if job was cancelled
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === 'cancelled') {
          throw new Error('Job cancelled by user');
        }

        const progress = calculateIndexProgress(event.current, event.total);

        this.jobService.updateJob(job.id, {
          message: `Indexed ${String(event.current)}/${String(event.total)} files`,
          progress: Math.min(99, progress), // Cap at 99 until fully complete
          details: {
            filesProcessed: event.current,
            totalFiles: event.total,
          },
        });
      }
    );

    if (!result.success) {
      throw result.error;
    }
  }

  /**
   * Execute a crawl job (web crawling + indexing)
   */
  private async executeCrawlJob(job: Job): Promise<void> {
    const { storeId, url, crawlInstruction, extractInstruction, maxPages, simple, useHeadless } =
      job.details;

    if (storeId === undefined || typeof storeId !== 'string') {
      throw new Error('Store ID required for crawl job');
    }
    if (url === undefined || typeof url !== 'string') {
      throw new Error('URL required for crawl job');
    }

    // Get the store
    const store = await this.storeService.get(createStoreId(storeId));
    if (store?.type !== 'web') {
      throw new Error(`Web store ${storeId} not found`);
    }

    const resolvedMaxPages = typeof maxPages === 'number' ? maxPages : 50;
    const crawler = new IntelligentCrawler();

    // Listen for progress events
    crawler.on('progress', (progress: CrawlProgress) => {
      // Check if job was cancelled - just return early, for-await loop will throw and finally will cleanup
      const currentJob = this.jobService.getJob(job.id);
      if (currentJob?.status === 'cancelled') {
        return;
      }

      // Crawling is 80% of total progress (0-80%)
      const crawlProgress = (progress.pagesVisited / resolvedMaxPages) * 80;

      this.jobService.updateJob(job.id, {
        message:
          progress.message ??
          `Crawling page ${String(progress.pagesVisited)}/${String(resolvedMaxPages)}`,
        progress: Math.min(80, crawlProgress),
        details: { pagesCrawled: progress.pagesVisited },
      });
    });

    try {
      await this.lanceStore.initialize(store.id);
      const docs: Document[] = [];

      // Build crawl options, only including defined values
      const crawlOptions: {
        maxPages: number;
        simple: boolean;
        useHeadless: boolean;
        crawlInstruction?: string;
        extractInstruction?: string;
      } = {
        maxPages: resolvedMaxPages,
        simple: simple ?? false,
        useHeadless: useHeadless ?? false,
      };
      if (crawlInstruction !== undefined) {
        crawlOptions.crawlInstruction = crawlInstruction;
      }
      if (extractInstruction !== undefined) {
        crawlOptions.extractInstruction = extractInstruction;
      }

      // Crawl pages using IntelligentCrawler
      for await (const result of crawler.crawl(url, crawlOptions)) {
        // Check cancellation between pages
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === 'cancelled') {
          throw new Error('Job cancelled by user');
        }

        // Embed and index the content (use extracted if available, otherwise markdown)
        const contentToEmbed = result.extracted ?? result.markdown;
        const vector = await this.embeddingEngine.embed(contentToEmbed);

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
      }

      // Index all documents (remaining 20%)
      if (docs.length > 0) {
        this.jobService.updateJob(job.id, {
          message: 'Indexing crawled documents...',
          progress: 85,
        });

        await this.lanceStore.addDocuments(store.id, docs);
      }

      this.jobService.updateJob(job.id, {
        message: `Crawled and indexed ${String(docs.length)} pages`,
        progress: 100,
        details: { pagesCrawled: docs.length },
      });
    } finally {
      await crawler.stop();
    }
  }
}
