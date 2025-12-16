import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
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
      chunkSize: options.chunkSize ?? 512,
      chunkOverlap: options.chunkOverlap ?? 50,
    });
  }

  async indexStore(store: Store, onProgress?: ProgressCallback): Promise<Result<IndexResult>> {
    const startTime = Date.now();

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
      const chunks = this.chunker.chunk(content);

      for (const chunk of chunks) {
        const vector = await this.embeddingEngine.embed(chunk.content);
        const chunkId = chunks.length > 1
          ? `${store.id}-${fileHash}-${chunk.chunkIndex}`
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
}
