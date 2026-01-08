import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { ChunkingService } from './chunking.service.js';
import { createLogger } from '../logging/index.js';
import { createDocumentId } from '../types/brands.js';
import { ok, err } from '../types/result.js';
import type { CodeGraphService } from './code-graph.service.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { LanceStore } from '../db/lance.js';
import type { Document } from '../types/document.js';
import type { ProgressCallback } from '../types/progress.js';
import type { Result } from '../types/result.js';
import type { Store, FileStore, RepoStore } from '../types/store.js';

const logger = createLogger('index-service');

interface IndexResult {
  documentsIndexed: number;
  chunksCreated: number;
  timeMs: number;
}

interface IndexOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  codeGraphService?: CodeGraphService;
}

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.json',
  '.yaml',
  '.yml',
  '.html',
  '.css',
  '.scss',
  '.less',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.sh',
  '.bash',
  '.zsh',
  '.sql',
  '.xml',
]);

export class IndexService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly chunker: ChunkingService;
  private readonly codeGraphService: CodeGraphService | undefined;

  constructor(
    lanceStore: LanceStore,
    embeddingEngine: EmbeddingEngine,
    options: IndexOptions = {}
  ) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
    this.chunker = new ChunkingService({
      chunkSize: options.chunkSize ?? 768,
      chunkOverlap: options.chunkOverlap ?? 100,
    });
    this.codeGraphService = options.codeGraphService;
  }

  async indexStore(store: Store, onProgress?: ProgressCallback): Promise<Result<IndexResult>> {
    logger.info(
      {
        storeId: store.id,
        storeName: store.name,
        storeType: store.type,
      },
      'Starting store indexing'
    );

    try {
      if (store.type === 'file' || store.type === 'repo') {
        return await this.indexFileStore(store, onProgress);
      }

      logger.error(
        { storeId: store.id, storeType: store.type },
        'Unsupported store type for indexing'
      );
      return err(new Error(`Indexing not supported for store type: ${store.type}`));
    } catch (error) {
      logger.error(
        {
          storeId: store.id,
          error: error instanceof Error ? error.message : String(error),
        },
        'Store indexing failed'
      );
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async indexFileStore(
    store: FileStore | RepoStore,
    onProgress?: ProgressCallback
  ): Promise<Result<IndexResult>> {
    const startTime = Date.now();
    const files = await this.scanDirectory(store.path);
    const documents: Document[] = [];
    let filesProcessed = 0;

    logger.debug(
      {
        storeId: store.id,
        path: store.path,
        fileCount: files.length,
      },
      'Files scanned for indexing'
    );

    // Collect source files for code graph building
    const sourceFiles: Array<{ path: string; content: string }> = [];

    // Emit start event
    onProgress?.({
      type: 'start',
      current: 0,
      total: files.length,
      message: 'Starting index',
    });

    for (const filePath of files) {
      const content = await readFile(filePath, 'utf-8');
      const fileHash = createHash('md5').update(content).digest('hex');
      // Pass file path for semantic Markdown chunking
      const chunks = this.chunker.chunk(content, filePath);

      // Determine file type for ranking
      const ext = extname(filePath).toLowerCase();
      const fileName = basename(filePath).toLowerCase();
      const fileType = this.classifyFileType(ext, fileName, filePath);

      // Collect source files for code graph
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        sourceFiles.push({ path: filePath, content });
      }

      for (const chunk of chunks) {
        const vector = await this.embeddingEngine.embed(chunk.content);
        const chunkId =
          chunks.length > 1
            ? `${store.id}-${fileHash}-${String(chunk.chunkIndex)}`
            : `${store.id}-${fileHash}`;

        const doc: Document = {
          id: createDocumentId(chunkId),
          content: chunk.content,
          vector,
          metadata: {
            type: chunks.length > 1 ? 'chunk' : 'file',
            storeId: store.id,
            path: filePath,
            indexedAt: new Date(),
            fileHash,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            // New metadata for ranking
            fileType,
            sectionHeader: chunk.sectionHeader,
            functionName: chunk.functionName,
            hasDocComments: /\/\*\*[\s\S]*?\*\//.test(chunk.content),
            docSummary: chunk.docSummary,
          },
        };
        documents.push(doc);
      }
      filesProcessed++;

      // Emit progress event
      onProgress?.({
        type: 'progress',
        current: filesProcessed,
        total: files.length,
        message: `Indexing ${filePath}`,
      });
    }

    if (documents.length > 0) {
      await this.lanceStore.addDocuments(store.id, documents);
    }

    // Build and save code graph if service is available and we have source files
    if (this.codeGraphService && sourceFiles.length > 0) {
      const graph = await this.codeGraphService.buildGraph(sourceFiles);
      await this.codeGraphService.saveGraph(store.id, graph);
    }

    // Emit complete event
    onProgress?.({
      type: 'complete',
      current: files.length,
      total: files.length,
      message: 'Indexing complete',
    });

    const timeMs = Date.now() - startTime;

    logger.info(
      {
        storeId: store.id,
        storeName: store.name,
        documentsIndexed: filesProcessed,
        chunksCreated: documents.length,
        sourceFilesForGraph: sourceFiles.length,
        timeMs,
      },
      'Store indexing complete'
    );

    return ok({
      documentsIndexed: filesProcessed,
      chunksCreated: documents.length,
      timeMs,
    });
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip common ignored directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          files.push(...(await this.scanDirectory(fullPath)));
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (TEXT_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Classify file type for ranking purposes.
   * Documentation files rank higher than source code for documentation queries.
   * Phase 4: Enhanced to detect internal implementation files.
   */
  private classifyFileType(ext: string, fileName: string, filePath: string): string {
    // Documentation files
    if (ext === '.md') {
      // CHANGELOG files get their own category for intent-based penalties
      if (fileName === 'changelog.md' || fileName === 'changes.md' || /changelog/i.test(fileName)) {
        return 'changelog';
      }
      // Special doc files get highest priority
      if (['readme.md', 'migration.md', 'contributing.md'].includes(fileName)) {
        return 'documentation-primary';
      }
      // Check path for documentation indicators
      if (/\/(docs?|documentation|guides?|tutorials?|articles?)\//i.test(filePath)) {
        return 'documentation';
      }
      return 'documentation';
    }

    // Test files
    if (/\.(test|spec)\.[jt]sx?$/.test(fileName) || /\/__tests__\//.test(filePath)) {
      return 'test';
    }

    // Example files
    if (/\/examples?\//.test(filePath) || fileName.includes('example')) {
      return 'example';
    }

    // Config files
    if (/^(tsconfig|package|\.eslint|\.prettier|vite\.config|next\.config)/i.test(fileName)) {
      return 'config';
    }

    // Source code - distinguish between internal and public-facing
    if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'].includes(ext)) {
      // Internal implementation files (monorepo packages, lib internals)
      // These patterns indicate internal/core implementation code
      if (this.isInternalImplementation(filePath, fileName)) {
        return 'source-internal';
      }
      return 'source';
    }

    return 'other';
  }

  /**
   * Detect if a source file is internal implementation code.
   * Internal code should rank lower than public-facing APIs and docs.
   */
  private isInternalImplementation(filePath: string, fileName: string): boolean {
    const pathLower = filePath.toLowerCase();
    const fileNameLower = fileName.toLowerCase();

    // Monorepo internal packages (like Vue's packages/*/src/)
    if (/\/packages\/[^/]+\/src\//.test(pathLower)) {
      // Exception: index files often export public APIs
      if (fileNameLower === 'index.ts' || fileNameLower === 'index.js') {
        return false;
      }
      return true;
    }

    // Internal/core directories
    if (/\/(internal|lib\/core|core\/src|_internal|private)\//.test(pathLower)) {
      return true;
    }

    // Compiler/transform internals (often not what users want)
    if (
      /\/(compiler|transforms?|parse|codegen)\//.test(pathLower) &&
      !fileNameLower.includes('readme') &&
      !fileNameLower.includes('index')
    ) {
      return true;
    }

    return false;
  }
}

/**
 * Classify web content type based on URL patterns and page title.
 * Used for ranking boosts similar to local file classification.
 */
export function classifyWebContentType(url: string, title?: string): string {
  const urlLower = url.toLowerCase();
  const titleLower = (title ?? '').toLowerCase();

  // API reference documentation → documentation-primary (1.8x boost)
  if (
    /\/api[-/]?(ref|reference|docs?)?\//i.test(urlLower) ||
    /api\s*(reference|documentation)/i.test(titleLower)
  ) {
    return 'documentation-primary';
  }

  // Getting started / tutorials → documentation-primary (1.8x boost)
  if (
    /\/(getting[-_]?started|quickstart|tutorial|setup)\b/i.test(urlLower) ||
    /(getting started|quickstart|tutorial)/i.test(titleLower)
  ) {
    return 'documentation-primary';
  }

  // General docs paths → documentation (1.5x boost)
  if (/\/(docs?|documentation|reference|learn|manual|guide)/i.test(urlLower)) {
    return 'documentation';
  }

  // Examples and demos → example (1.4x boost)
  if (/\/(examples?|demos?|samples?|cookbook)/i.test(urlLower)) {
    return 'example';
  }

  // Changelog → changelog (special handling in intent boosts)
  if (/changelog|release[-_]?notes/i.test(urlLower)) {
    return 'changelog';
  }

  // Blog posts → lower priority
  if (/\/blog\//i.test(urlLower)) {
    return 'other';
  }

  // Web content without specific path indicators is treated as documentation
  return 'documentation';
}
