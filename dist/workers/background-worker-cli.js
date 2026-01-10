#!/usr/bin/env node
import {
  IntelligentCrawler
} from "../chunk-Q2ZGPJ66.js";
import {
  JobService,
  createDocumentId,
  createLogger,
  createServices,
  createStoreId,
  shutdownLogger
} from "../chunk-MQGRQ2EG.js";
import "../chunk-HRQD3MPH.js";

// src/workers/background-worker.ts
import { createHash } from "crypto";
var logger = createLogger("background-worker");
function calculateIndexProgress(current, total, scale = 100) {
  if (total === 0) return 0;
  return current / total * scale;
}
var BackgroundWorker = class {
  constructor(jobService, storeService, indexService, lanceStore, embeddingEngine) {
    this.jobService = jobService;
    this.storeService = storeService;
    this.indexService = indexService;
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
  }
  /**
   * Execute a job based on its type
   */
  async executeJob(jobId) {
    const job = this.jobService.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }
    try {
      logger.info({ jobId, type: job.type }, "Starting job execution");
      this.jobService.updateJob(jobId, {
        status: "running",
        message: `Starting ${job.type} operation...`,
        progress: 0,
        details: { startedAt: (/* @__PURE__ */ new Date()).toISOString() }
      });
      switch (job.type) {
        case "clone":
          await this.executeCloneJob(job);
          break;
        case "index":
          await this.executeIndexJob(job);
          break;
        case "crawl":
          await this.executeCrawlJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${String(job.type)}`);
      }
      this.jobService.updateJob(jobId, {
        status: "completed",
        progress: 100,
        message: `${job.type} operation completed successfully`,
        details: { completedAt: (/* @__PURE__ */ new Date()).toISOString() }
      });
    } catch (error) {
      logger.error(
        { jobId, error: error instanceof Error ? error.message : String(error) },
        "Job failed"
      );
      const errorDetails = {
        completedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (error instanceof Error && error.stack !== void 0) {
        errorDetails["error"] = error.stack;
      } else {
        errorDetails["error"] = String(error);
      }
      this.jobService.updateJob(jobId, {
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown error",
        details: errorDetails
      });
      throw error;
    }
  }
  /**
   * Execute a clone job (git clone + initial indexing)
   */
  async executeCloneJob(job) {
    const { storeId } = job.details;
    if (storeId === void 0 || typeof storeId !== "string") {
      throw new Error("Store ID required for clone job");
    }
    const store = await this.storeService.get(createStoreId(storeId));
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }
    this.jobService.updateJob(job.id, {
      status: "running",
      message: "Repository cloned, starting indexing...",
      progress: 30
    });
    const result = await this.indexService.indexStore(
      store,
      (event) => {
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === "cancelled") {
          throw new Error("Job cancelled by user");
        }
        const indexProgress = calculateIndexProgress(event.current, event.total, 70);
        const totalProgress = 30 + indexProgress;
        this.jobService.updateJob(job.id, {
          message: `Indexed ${String(event.current)}/${String(event.total)} files`,
          progress: Math.min(99, totalProgress),
          // Cap at 99 until fully complete
          details: {
            filesProcessed: event.current,
            totalFiles: event.total
          }
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
  async executeIndexJob(job) {
    const { storeId } = job.details;
    if (storeId === void 0 || typeof storeId !== "string") {
      throw new Error("Store ID required for index job");
    }
    const store = await this.storeService.getByIdOrName(createStoreId(storeId));
    if (!store) {
      throw new Error(`Store ${storeId} not found`);
    }
    const result = await this.indexService.indexStore(
      store,
      (event) => {
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === "cancelled") {
          throw new Error("Job cancelled by user");
        }
        const progress = calculateIndexProgress(event.current, event.total);
        this.jobService.updateJob(job.id, {
          message: `Indexed ${String(event.current)}/${String(event.total)} files`,
          progress: Math.min(99, progress),
          // Cap at 99 until fully complete
          details: {
            filesProcessed: event.current,
            totalFiles: event.total
          }
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
  async executeCrawlJob(job) {
    const { storeId, url, crawlInstruction, extractInstruction, maxPages, simple, useHeadless } = job.details;
    if (storeId === void 0 || typeof storeId !== "string") {
      throw new Error("Store ID required for crawl job");
    }
    if (url === void 0 || typeof url !== "string") {
      throw new Error("URL required for crawl job");
    }
    const store = await this.storeService.get(createStoreId(storeId));
    if (store?.type !== "web") {
      throw new Error(`Web store ${storeId} not found`);
    }
    const resolvedMaxPages = typeof maxPages === "number" ? maxPages : 50;
    const crawler = new IntelligentCrawler();
    crawler.on("progress", (progress) => {
      const currentJob = this.jobService.getJob(job.id);
      if (currentJob?.status === "cancelled") {
        return;
      }
      const crawlProgress = progress.pagesVisited / resolvedMaxPages * 80;
      this.jobService.updateJob(job.id, {
        message: progress.message ?? `Crawling page ${String(progress.pagesVisited)}/${String(resolvedMaxPages)}`,
        progress: Math.min(80, crawlProgress),
        details: { pagesCrawled: progress.pagesVisited }
      });
    });
    try {
      await this.lanceStore.initialize(store.id);
      const docs = [];
      const crawlOptions = {
        maxPages: resolvedMaxPages,
        simple: simple ?? false,
        useHeadless: useHeadless ?? true
        // Default to headless for reliability
      };
      if (crawlInstruction !== void 0) {
        crawlOptions.crawlInstruction = crawlInstruction;
      }
      if (extractInstruction !== void 0) {
        crawlOptions.extractInstruction = extractInstruction;
      }
      for await (const result of crawler.crawl(url, crawlOptions)) {
        const currentJob = this.jobService.getJob(job.id);
        if (currentJob?.status === "cancelled") {
          throw new Error("Job cancelled by user");
        }
        const contentToEmbed = result.extracted ?? result.markdown;
        const vector = await this.embeddingEngine.embed(contentToEmbed);
        docs.push({
          id: createDocumentId(`${store.id}-${createHash("md5").update(result.url).digest("hex")}`),
          content: contentToEmbed,
          vector,
          metadata: {
            type: "web",
            storeId: store.id,
            url: result.url,
            title: result.title,
            extracted: result.extracted !== void 0,
            depth: result.depth,
            indexedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      if (docs.length > 0) {
        this.jobService.updateJob(job.id, {
          message: "Indexing crawled documents...",
          progress: 85
        });
        await this.lanceStore.addDocuments(store.id, docs);
        await this.lanceStore.createFtsIndex(store.id);
      }
      this.jobService.updateJob(job.id, {
        message: `Crawled and indexed ${String(docs.length)} pages`,
        progress: 100,
        details: { pagesCrawled: docs.length }
      });
    } finally {
      await crawler.stop();
    }
  }
};

// src/workers/pid-file.ts
import fs from "fs";
import path from "path";
function writePidFile(pidFile, pid) {
  try {
    fs.writeFileSync(pidFile, pid.toString(), "utf-8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `CRITICAL: Failed to write PID file ${pidFile}. Job cannot be cancelled without PID file. Original error: ${message}`
    );
  }
}
function deletePidFile(pidFile, _context) {
  try {
    fs.unlinkSync(pidFile);
    return { success: true };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { success: true };
    }
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
function buildPidFilePath(jobsDir, jobId) {
  return path.join(jobsDir, `${jobId}.pid`);
}

// src/workers/background-worker-cli.ts
var logger2 = createLogger("background-worker-cli");
async function main() {
  const jobId = process.argv[2];
  const dataDir = process.env["BLUERA_DATA_DIR"];
  if (jobId === void 0 || jobId === "") {
    logger2.error("Job ID required. Usage: background-worker-cli <job-id>");
    await shutdownLogger();
    process.exit(1);
  }
  const jobService = new JobService(dataDir);
  const services = await createServices(void 0, dataDir);
  const pidFile = buildPidFilePath(
    jobService["jobsDir"],
    // Access private field for PID path
    jobId
  );
  try {
    writePidFile(pidFile, process.pid);
  } catch (error) {
    logger2.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Failed to write PID file"
    );
    await shutdownLogger();
    process.exit(1);
  }
  process.on("SIGTERM", () => {
    logger2.info({ jobId }, "Received SIGTERM, cancelling job");
    jobService.updateJob(jobId, {
      status: "cancelled",
      message: "Job cancelled by user"
    });
    const deleteResult = deletePidFile(pidFile, "sigterm");
    if (!deleteResult.success && deleteResult.error !== void 0) {
      logger2.warn(
        { jobId, error: deleteResult.error.message },
        "Could not remove PID file during SIGTERM"
      );
    }
    void shutdownLogger().finally(() => process.exit(0));
  });
  const worker = new BackgroundWorker(
    jobService,
    services.store,
    services.index,
    services.lance,
    services.embeddings
  );
  try {
    await worker.executeJob(jobId);
    const successCleanup = deletePidFile(pidFile, "success");
    if (!successCleanup.success && successCleanup.error !== void 0) {
      logger2.warn(
        { jobId, error: successCleanup.error.message },
        "Could not remove PID file after success"
      );
    }
    logger2.info({ jobId }, "Job completed successfully");
    await shutdownLogger();
    process.exit(0);
  } catch (error) {
    logger2.error(
      { jobId, error: error instanceof Error ? error.message : String(error) },
      "Job failed"
    );
    const failureCleanup = deletePidFile(pidFile, "failure");
    if (!failureCleanup.success && failureCleanup.error !== void 0) {
      logger2.warn(
        { jobId, error: failureCleanup.error.message },
        "Could not remove PID file after failure"
      );
    }
    await shutdownLogger();
    process.exit(1);
  }
}
main().catch(async (error) => {
  logger2.error(
    { error: error instanceof Error ? error.message : String(error) },
    "Fatal error in background worker"
  );
  await shutdownLogger();
  process.exit(1);
});
//# sourceMappingURL=background-worker-cli.js.map