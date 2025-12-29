import { readFile, readdir } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { Store, FileStore, RepoStore } from '../types/store.js';
import type { Document } from '../types/document.js';
import { createDocumentId } from '../types/brands.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';
import { ChunkingService } from './chunking.service.js';
import type { ProgressCallback } from '../types/progress.js';

interface IndexResult {
  documentsIndexed: number;
  chunksCreated: number;
  timeMs: number;
}

interface IndexOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
  '.html', '.css', '.scss', '.less', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.sh', '.bash', '.zsh', '.sql', '.xml',
]);

export class IndexService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly chunker: ChunkingService;

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
  }

  async indexStore(store: Store, onProgress?: ProgressCallback): Promise<Result<IndexResult>> {
    try {
      if (store.type === 'file' || store.type === 'repo') {
        return await this.indexFileStore(store, onProgress);
      }

      return err(new Error(`Indexing not supported for store type: ${store.type}`));
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async indexFileStore(store: FileStore | RepoStore, onProgress?: ProgressCallback): Promise<Result<IndexResult>> {
    const startTime = Date.now();
    const files = await this.scanDirectory(store.path);
    const documents: Document[] = [];
    let filesProcessed = 0;

    // Emit start event
    onProgress?.({
      type: 'start',
      current: 0,
      total: files.length,
      message: 'Starting index'
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

      for (const chunk of chunks) {
        const vector = await this.embeddingEngine.embed(chunk.content);
        const chunkId = chunks.length > 1
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
        message: `Indexing ${filePath}`
      });
    }

    if (documents.length > 0) {
      await this.lanceStore.addDocuments(store.id, documents);
    }

    // Emit complete event
    onProgress?.({
      type: 'complete',
      current: files.length,
      total: files.length,
      message: 'Indexing complete'
    });

    return ok({
      documentsIndexed: filesProcessed,
      chunksCreated: documents.length,
      timeMs: Date.now() - startTime,
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
    if (/\/(compiler|transforms?|parse|codegen)\//.test(pathLower) &&
        !fileNameLower.includes('readme') && !fileNameLower.includes('index')) {
      return true;
    }

    return false;
  }
}
