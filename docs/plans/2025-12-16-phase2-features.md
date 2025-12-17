# Phase 2 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all remaining features from the CLI specification: document chunking, full-text search, hybrid search, progress bars, HTTP server, file watching, web crawling, and export/import.

**Architecture:** Build incrementally on existing service layer. Add chunking to IndexService, FTS to LanceStore, hybrid search to SearchService. Add Hono server that reuses same services. Python bridge for web crawling via JSON-RPC subprocess.

**Tech Stack:** LanceDB (FTS built-in), Hono, ora, chokidar, Python crawl4ai

---

## Group A: Search Improvements

### Task A.1: Create ChunkingService

**Files:**
- Create: `src/services/chunking.service.ts`
- Create: `src/services/chunking.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/chunking.service.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ChunkingService } from './chunking.service.js';

describe('ChunkingService', () => {
  const chunker = new ChunkingService({ chunkSize: 100, chunkOverlap: 20 });

  it('splits text into chunks', () => {
    const text = 'A'.repeat(250);
    const chunks = chunker.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => c.content.length <= 100)).toBe(true);
  });

  it('preserves overlap between chunks', () => {
    const text = 'word '.repeat(50); // 250 chars
    const chunks = chunker.chunk(text);
    if (chunks.length >= 2) {
      const end1 = chunks[0]!.content.slice(-20);
      const start2 = chunks[1]!.content.slice(0, 20);
      expect(end1).toBe(start2);
    }
  });

  it('returns single chunk for small text', () => {
    const text = 'small text';
    const chunks = chunker.chunk(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe(text);
  });

  it('assigns chunk indices', () => {
    const text = 'A'.repeat(300);
    const chunks = chunker.chunk(text);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[1]!.chunkIndex).toBe(1);
    expect(chunks.every(c => c.totalChunks === chunks.length)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/chunking.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Write implementation**

Create `src/services/chunking.service.ts`:
```typescript
export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export interface Chunk {
  content: string;
  chunkIndex: number;
  totalChunks: number;
  startOffset: number;
  endOffset: number;
}

export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(config: ChunkConfig) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  chunk(text: string): Chunk[] {
    if (text.length <= this.chunkSize) {
      return [{
        content: text,
        chunkIndex: 0,
        totalChunks: 1,
        startOffset: 0,
        endOffset: text.length,
      }];
    }

    const chunks: Chunk[] = [];
    const step = this.chunkSize - this.chunkOverlap;
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push({
        content: text.slice(start, end),
        chunkIndex: chunks.length,
        totalChunks: 0, // Will be set after
        startOffset: start,
        endOffset: end,
      });
      start += step;
      if (end === text.length) break;
    }

    // Set totalChunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/chunking.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/chunking.service.ts src/services/chunking.service.test.ts
git commit -m "feat: add ChunkingService for document splitting"
```

---

### Task A.2: Integrate chunking into IndexService

**Files:**
- Modify: `src/services/index.service.ts`
- Modify: `src/services/index.service.test.ts`

**Step 1: Update test to verify chunking**

Add to `src/services/index.service.test.ts`:
```typescript
it('chunks large files', async () => {
  // Create a large test file
  const largeContent = 'This is test content. '.repeat(100); // ~2200 chars
  await writeFile(join(testFilesDir, 'large.txt'), largeContent);

  const store: FileStore = {
    type: 'file',
    id: storeId,
    name: 'Test Store',
    path: testFilesDir,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await indexService.indexStore(store);

  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.chunksCreated).toBeGreaterThan(result.data.documentsIndexed);
  }
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/index.service.test.ts
```

Expected: FAIL - chunks equal documents (no chunking)

**Step 3: Update IndexService implementation**

Update `src/services/index.service.ts`:
```typescript
import { readFile, readdir } from 'node:fs/promises';
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

  async indexStore(store: Store): Promise<Result<IndexResult>> {
    try {
      if (store.type === 'file' || store.type === 'repo') {
        return await this.indexFileStore(store);
      }
      return err(new Error(`Indexing not supported for store type: ${store.type}`));
    } catch (error) {
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async indexFileStore(store: FileStore | RepoStore): Promise<Result<IndexResult>> {
    const startTime = Date.now();
    const files = await this.scanDirectory(store.path);
    const documents: Document[] = [];
    let filesProcessed = 0;

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
    }

    if (documents.length > 0) {
      await this.lanceStore.addDocuments(store.id, documents);
    }

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
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/index.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/index.service.ts src/services/index.service.test.ts
git commit -m "feat: integrate chunking into IndexService"
```

---

### Task A.3: Add full-text search to LanceStore

**Files:**
- Modify: `src/db/lance.ts`
- Modify: `src/db/lance.test.ts`

**Step 1: Add FTS test**

Add to `src/db/lance.test.ts`:
```typescript
it('performs full-text search', async () => {
  const doc = {
    id: createDocumentId('fts-doc'),
    content: 'The quick brown fox jumps over the lazy dog',
    vector: new Array(384).fill(0.1),
    metadata: {
      type: 'file' as const,
      storeId,
      indexedAt: new Date(),
    },
  };

  await store.addDocuments(storeId, [doc]);

  const results = await store.fullTextSearch(storeId, 'quick brown', 10);
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]?.content).toContain('quick');
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/db/lance.test.ts
```

Expected: FAIL - fullTextSearch not defined

**Step 3: Add FTS implementation**

Add to `src/db/lance.ts`:
```typescript
async createFtsIndex(storeId: StoreId): Promise<void> {
  const table = await this.getTable(storeId);
  await table.createIndex('content', {
    config: lancedb.Index.fts(),
  });
}

async fullTextSearch(
  storeId: StoreId,
  query: string,
  limit: number
): Promise<Array<{ id: DocumentId; content: string; score: number; metadata: DocumentMetadata }>> {
  const table = await this.getTable(storeId);

  try {
    const results = await table
      .search(query, 'fts')
      .limit(limit)
      .toArray() as Array<{ id: string; content: string; metadata: string; score: number }>;

    return results.map((r) => ({
      id: createDocumentId(r.id),
      content: r.content,
      score: r.score ?? 1,
      metadata: JSON.parse(r.metadata) as DocumentMetadata,
    }));
  } catch {
    // FTS index may not exist, return empty
    return [];
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/db/lance.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/db/lance.ts src/db/lance.test.ts
git commit -m "feat: add full-text search to LanceStore"
```

---

### Task A.4: Add hybrid search with RRF to SearchService

**Files:**
- Modify: `src/services/search.service.ts`
- Modify: `src/services/search.service.test.ts`

**Step 1: Add hybrid search test**

Add to `src/services/search.service.test.ts`:
```typescript
it('performs hybrid search combining vector and FTS', async () => {
  const results = await searchService.search({
    query: 'JavaScript programming',
    stores: [storeId],
    mode: 'hybrid',
    limit: 10,
  });

  expect(results.mode).toBe('hybrid');
  expect(results.results.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/search.service.test.ts
```

Expected: FAIL or PASS (current implementation falls back to vector)

**Step 3: Implement hybrid search with RRF**

Update `src/services/search.service.ts`:
```typescript
import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { SearchQuery, SearchResponse, SearchResult } from '../types/search.js';
import type { StoreId, DocumentId } from '../types/brands.js';

interface RRFConfig {
  k: number;
  vectorWeight: number;
  ftsWeight: number;
}

export class SearchService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly rrfConfig: RRFConfig;

  constructor(
    lanceStore: LanceStore,
    embeddingEngine: EmbeddingEngine,
    rrfConfig: RRFConfig = { k: 60, vectorWeight: 0.7, ftsWeight: 0.3 }
  ) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
    this.rrfConfig = rrfConfig;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const mode = query.mode ?? 'hybrid';
    const limit = query.limit ?? 10;
    const stores = query.stores ?? [];

    let allResults: SearchResult[] = [];

    if (mode === 'vector') {
      allResults = await this.vectorSearch(query.query, stores, limit, query.threshold);
    } else if (mode === 'fts') {
      allResults = await this.ftsSearch(query.query, stores, limit);
    } else {
      // Hybrid: combine vector and FTS with RRF
      allResults = await this.hybridSearch(query.query, stores, limit, query.threshold);
    }

    return {
      query: query.query,
      mode,
      stores,
      results: allResults,
      totalResults: allResults.length,
      timeMs: Date.now() - startTime,
    };
  }

  private async vectorSearch(
    query: string,
    stores: readonly StoreId[],
    limit: number,
    threshold?: number
  ): Promise<SearchResult[]> {
    const queryVector = await this.embeddingEngine.embed(query);
    const results: SearchResult[] = [];

    for (const storeId of stores) {
      const hits = await this.lanceStore.search(storeId, queryVector, limit, threshold);
      results.push(...hits.map(r => ({
        id: r.id,
        score: r.score,
        content: r.content,
        metadata: r.metadata,
      })));
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async ftsSearch(
    query: string,
    stores: readonly StoreId[],
    limit: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const storeId of stores) {
      const hits = await this.lanceStore.fullTextSearch(storeId, query, limit);
      results.push(...hits.map(r => ({
        id: r.id,
        score: r.score,
        content: r.content,
        metadata: r.metadata,
      })));
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async hybridSearch(
    query: string,
    stores: readonly StoreId[],
    limit: number,
    threshold?: number
  ): Promise<SearchResult[]> {
    // Get both result sets
    const [vectorResults, ftsResults] = await Promise.all([
      this.vectorSearch(query, stores, limit * 2, threshold),
      this.ftsSearch(query, stores, limit * 2),
    ]);

    // Build rank maps
    const vectorRanks = new Map<string, number>();
    const ftsRanks = new Map<string, number>();
    const allDocs = new Map<string, SearchResult>();

    vectorResults.forEach((r, i) => {
      vectorRanks.set(r.id, i + 1);
      allDocs.set(r.id, r);
    });

    ftsResults.forEach((r, i) => {
      ftsRanks.set(r.id, i + 1);
      if (!allDocs.has(r.id)) {
        allDocs.set(r.id, r);
      }
    });

    // Calculate RRF scores
    const rrfScores: Array<{ id: string; score: number; result: SearchResult }> = [];
    const { k, vectorWeight, ftsWeight } = this.rrfConfig;

    for (const [id, result] of allDocs) {
      const vectorRank = vectorRanks.get(id) ?? Infinity;
      const ftsRank = ftsRanks.get(id) ?? Infinity;

      const vectorRRF = vectorRank !== Infinity ? vectorWeight / (k + vectorRank) : 0;
      const ftsRRF = ftsRank !== Infinity ? ftsWeight / (k + ftsRank) : 0;

      rrfScores.push({
        id,
        score: vectorRRF + ftsRRF,
        result,
      });
    }

    // Sort by RRF score and return
    return rrfScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => ({ ...r.result, score: r.score }));
  }

  async searchAllStores(query: SearchQuery, storeIds: StoreId[]): Promise<SearchResponse> {
    return this.search({ ...query, stores: storeIds });
  }
}
```

**Step 4: Run all search tests**

```bash
npm run test:run -- src/services/search.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/search.service.ts src/services/search.service.test.ts
git commit -m "feat: add hybrid search with RRF fusion"
```

---

## Group B: User Experience

### Task B.1: Add progress reporting to IndexService

**Files:**
- Modify: `src/services/index.service.ts`
- Create: `src/types/progress.ts`

**Step 1: Create progress types**

Create `src/types/progress.ts`:
```typescript
export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
  details?: Record<string, unknown>;
}

export type ProgressCallback = (event: ProgressEvent) => void;
```

**Step 2: Add progress callback to IndexService**

Update `src/services/index.service.ts` to accept optional progress callback:
```typescript
async indexStore(
  store: Store,
  onProgress?: ProgressCallback
): Promise<Result<IndexResult>> {
  // ... in indexFileStore, emit progress events:
  onProgress?.({ type: 'start', current: 0, total: files.length, message: 'Starting index' });

  // In loop:
  onProgress?.({
    type: 'progress',
    current: filesProcessed,
    total: files.length,
    message: `Indexing ${filePath}`
  });

  // At end:
  onProgress?.({ type: 'complete', current: files.length, total: files.length, message: 'Indexing complete' });
}
```

**Step 3: Commit**

```bash
git add src/types/progress.ts src/services/index.service.ts
git commit -m "feat: add progress callback to IndexService"
```

---

### Task B.2: Add progress bars to CLI

**Files:**
- Modify: `src/cli/commands/index-cmd.ts`

**Step 1: Update index command with ora spinner**

Update `src/cli/commands/index-cmd.ts`:
```typescript
import { Command } from 'commander';
import ora from 'ora';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';

export function createIndexCommand(getOptions: () => GlobalOptions): Command {
  const index = new Command('index')
    .description('Index a knowledge store')
    .argument('<store>', 'Store ID or name')
    .option('--force', 'Force reindex all files')
    .action(async (storeIdOrName: string, options: { force?: boolean }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (store === undefined) {
        console.error(`Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      const spinner = ora(`Indexing store: ${store.name}`).start();
      await services.lance.initialize(store.id);

      const result = await services.index.indexStore(store, (event) => {
        if (event.type === 'progress') {
          spinner.text = `Indexing: ${event.current}/${event.total} files - ${event.message}`;
        }
      });

      if (result.success) {
        spinner.succeed(`Indexed ${result.data.documentsIndexed} files, ${result.data.chunksCreated} chunks in ${result.data.timeMs}ms`);
        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(result.data, null, 2));
        }
      } else {
        spinner.fail(`Error: ${result.error.message}`);
        process.exit(4);
      }
    });

  return index;
}
```

**Step 2: Build and test**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/cli/commands/index-cmd.ts
git commit -m "feat: add progress spinner to index command"
```

---

### Task B.3: Add file watching

**Files:**
- Create: `src/services/watch.service.ts`
- Modify: `src/cli/commands/index-cmd.ts`

**Step 1: Create WatchService**

Create `src/services/watch.service.ts`:
```typescript
import { watch, type FSWatcher } from 'chokidar';
import type { Store, FileStore, RepoStore } from '../types/store.js';
import type { IndexService } from './index.service.js';
import type { LanceStore } from '../db/lance.js';

export class WatchService {
  private watchers: Map<string, FSWatcher> = new Map();
  private readonly indexService: IndexService;
  private readonly lanceStore: LanceStore;

  constructor(indexService: IndexService, lanceStore: LanceStore) {
    this.indexService = indexService;
    this.lanceStore = lanceStore;
  }

  async watch(
    store: FileStore | RepoStore,
    debounceMs = 1000,
    onReindex?: () => void
  ): Promise<void> {
    if (this.watchers.has(store.id)) {
      return; // Already watching
    }

    let timeout: NodeJS.Timeout | null = null;

    const watcher = watch(store.path, {
      ignored: /(^|[\/\\])\.(git|node_modules|dist|build)/,
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on('all', () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await this.lanceStore.initialize(store.id);
        await this.indexService.indexStore(store);
        onReindex?.();
      }, debounceMs);
    });

    this.watchers.set(store.id, watcher);
  }

  async unwatch(storeId: string): Promise<void> {
    const watcher = this.watchers.get(storeId);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(storeId);
    }
  }

  async unwatchAll(): Promise<void> {
    for (const [id] of this.watchers) {
      await this.unwatch(id);
    }
  }
}
```

**Step 2: Add watch subcommand to index**

Add to `src/cli/commands/index-cmd.ts`:
```typescript
index
  .command('watch <store>')
  .description('Watch for changes and auto-reindex')
  .option('--debounce <ms>', 'Debounce interval in ms', '1000')
  .action(async (storeIdOrName: string, options: { debounce?: string }) => {
    const globalOpts = getOptions();
    const services = await createServices(globalOpts.config, globalOpts.dataDir);

    const store = await services.store.getByIdOrName(storeIdOrName);
    if (store === undefined || (store.type !== 'file' && store.type !== 'repo')) {
      console.error(`File/repo store not found: ${storeIdOrName}`);
      process.exit(3);
    }

    const { WatchService } = await import('../../services/watch.service.js');
    const watchService = new WatchService(services.index, services.lance);

    console.log(`Watching ${store.name} for changes...`);
    await watchService.watch(store, parseInt(options.debounce ?? '1000', 10), () => {
      console.log(`Re-indexed ${store.name}`);
    });

    // Keep process alive
    process.on('SIGINT', async () => {
      await watchService.unwatchAll();
      process.exit(0);
    });
  });
```

**Step 3: Commit**

```bash
git add src/services/watch.service.ts src/cli/commands/index-cmd.ts
git commit -m "feat: add file watching with auto-reindex"
```

---

## Group C: HTTP Server

### Task C.1: Create Hono server

**Files:**
- Create: `src/server/app.ts`
- Modify: `src/server/index.ts`

**Step 1: Create server app**

Create `src/server/app.ts`:
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ServiceContainer } from '../services/index.js';

export function createApp(services: ServiceContainer): Hono {
  const app = new Hono();

  app.use('*', cors());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Stores
  app.get('/api/stores', async (c) => {
    const stores = await services.store.list();
    return c.json(stores);
  });

  app.post('/api/stores', async (c) => {
    const body = await c.req.json();
    const result = await services.store.create(body);
    if (result.success) {
      return c.json(result.data, 201);
    }
    return c.json({ error: result.error.message }, 400);
  });

  app.get('/api/stores/:id', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);
    return c.json(store);
  });

  app.delete('/api/stores/:id', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);
    const result = await services.store.delete(store.id);
    if (result.success) return c.json({ deleted: true });
    return c.json({ error: result.error.message }, 400);
  });

  // Search
  app.post('/api/search', async (c) => {
    const body = await c.req.json();
    const storeIds = (await services.store.list()).map(s => s.id);

    for (const id of storeIds) {
      await services.lance.initialize(id);
    }

    const results = await services.search.search({
      ...body,
      stores: body.stores ?? storeIds,
    });
    return c.json(results);
  });

  // Index
  app.post('/api/stores/:id/index', async (c) => {
    const store = await services.store.getByIdOrName(c.req.param('id'));
    if (!store) return c.json({ error: 'Not found' }, 404);

    await services.lance.initialize(store.id);
    const result = await services.index.indexStore(store);

    if (result.success) return c.json(result.data);
    return c.json({ error: result.error.message }, 400);
  });

  return app;
}
```

**Step 2: Update server barrel**

Update `src/server/index.ts`:
```typescript
export { createApp } from './app.js';
```

**Step 3: Commit**

```bash
git add src/server/app.ts src/server/index.ts
git commit -m "feat: add Hono HTTP server with REST API"
```

---

### Task C.2: Add serve command

**Files:**
- Create: `src/cli/commands/serve.ts`
- Modify: `src/index.ts`

**Step 1: Create serve command**

Create `src/cli/commands/serve.ts`:
```typescript
import { Command } from 'commander';
import { serve } from '@hono/node-server';
import { createServices } from '../../services/index.js';
import { createApp } from '../../server/app.js';
import type { GlobalOptions } from '../program.js';

export function createServeCommand(getOptions: () => GlobalOptions): Command {
  return new Command('serve')
    .description('Start HTTP server for API access')
    .option('-p, --port <port>', 'Port number', '3847')
    .option('--host <host>', 'Host to bind', '127.0.0.1')
    .action(async (options: { port?: string; host?: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const app = createApp(services);

      const port = parseInt(options.port ?? '3847', 10);
      const host = options.host ?? '127.0.0.1';

      console.log(`Starting server on http://${host}:${port}`);

      serve({
        fetch: app.fetch,
        port,
        hostname: host,
      });
    });
}
```

**Step 2: Register serve command**

Update `src/index.ts`:
```typescript
import { createServeCommand } from './cli/commands/serve.js';

// Add with other commands:
program.addCommand(createServeCommand(() => getGlobalOptions(program)));
```

**Step 3: Update CLI barrel**

Update `src/cli/index.ts`:
```typescript
export { createServeCommand } from './commands/serve.js';
```

**Step 4: Commit**

```bash
git add src/cli/commands/serve.ts src/index.ts src/cli/index.ts
git commit -m "feat: add serve command for HTTP server"
```

---

## Group D: Web Crawling

### Task D.1: Create Python crawl worker

**Files:**
- Create: `python/requirements.txt`
- Create: `python/crawl_worker.py`

**Step 1: Create requirements.txt**

Create `python/requirements.txt`:
```
crawl4ai>=0.3.0
beautifulsoup4>=4.12.0
```

**Step 2: Create crawl worker**

Create `python/crawl_worker.py`:
```python
#!/usr/bin/env python3
import sys
import json
from crawl4ai import WebCrawler

def main():
    crawler = WebCrawler()
    crawler.warmup()

    for line in sys.stdin:
        try:
            request = json.loads(line.strip())
            if request.get('method') == 'crawl':
                params = request.get('params', {})
                url = params.get('url')

                result = crawler.run(url=url)

                response = {
                    'jsonrpc': '2.0',
                    'id': request.get('id'),
                    'result': {
                        'pages': [{
                            'url': url,
                            'title': result.title or '',
                            'content': result.markdown or result.text or '',
                            'links': result.links or [],
                            'crawledAt': result.crawled_at or '',
                        }]
                    }
                }
                print(json.dumps(response), flush=True)

        except Exception as e:
            error_response = {
                'jsonrpc': '2.0',
                'id': request.get('id') if 'request' in dir() else None,
                'error': {'code': -1, 'message': str(e)}
            }
            print(json.dumps(error_response), flush=True)

if __name__ == '__main__':
    main()
```

**Step 3: Commit**

```bash
git add python/
git commit -m "feat: add Python crawl worker with crawl4ai"
```

---

### Task D.2: Create Python bridge

**Files:**
- Create: `src/crawl/bridge.ts`

**Step 1: Create bridge**

Create `src/crawl/bridge.ts`:
```typescript
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';

interface CrawlResult {
  pages: Array<{
    url: string;
    title: string;
    content: string;
    links: string[];
    crawledAt: string;
  }>;
}

export class PythonBridge {
  private process: ChildProcess | null = null;
  private pending: Map<string, { resolve: (v: CrawlResult) => void; reject: (e: Error) => void }> = new Map();

  async start(): Promise<void> {
    if (this.process) return;

    this.process = spawn('python3', ['python/crawl_worker.py'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const rl = createInterface({ input: this.process.stdout! });
    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        const pending = this.pending.get(response.id);
        if (pending) {
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
          this.pending.delete(response.id);
        }
      } catch {}
    });
  }

  async crawl(url: string): Promise<CrawlResult> {
    if (!this.process) await this.start();

    const id = randomUUID();
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'crawl',
      params: { url },
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process!.stdin!.write(JSON.stringify(request) + '\n');
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
```

**Step 2: Commit**

```bash
git add src/crawl/bridge.ts
git commit -m "feat: add Python bridge for web crawling"
```

---

### Task D.3: Add crawl command

**Files:**
- Create: `src/cli/commands/crawl.ts`
- Modify: `src/index.ts`

**Step 1: Create crawl command**

Create `src/cli/commands/crawl.ts`:
```typescript
import { Command } from 'commander';
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
            id: createDocumentId(`${store.id}-${Buffer.from(page.url).toString('base64').slice(0, 20)}`),
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
        spinner.fail(`Crawl failed: ${error}`);
        process.exit(6);
      } finally {
        await bridge.stop();
      }
    });
}
```

**Step 2: Register command**

Update `src/index.ts`:
```typescript
import { createCrawlCommand } from './cli/commands/crawl.js';

program.addCommand(createCrawlCommand(() => getGlobalOptions(program)));
```

**Step 3: Commit**

```bash
git add src/cli/commands/crawl.ts src/index.ts
git commit -m "feat: add crawl command for web content"
```

---

## Group E: Export/Import

### Task E.1: Add export command

**Files:**
- Create: `src/cli/commands/export.ts`

**Step 1: Create export command**

Create `src/cli/commands/export.ts`:
```typescript
import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';

export function createExportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('export')
    .description('Export store to file')
    .argument('<store>', 'Store ID or name')
    .requiredOption('-o, --output <path>', 'Output file path')
    .action(async (storeIdOrName: string, options: { output: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const store = await services.store.getByIdOrName(storeIdOrName);
      if (!store) {
        console.error('Store not found:', storeIdOrName);
        process.exit(3);
      }

      await services.lance.initialize(store.id);

      // Get all documents by doing a search with empty vector
      const dummyVector = new Array(384).fill(0);
      const docs = await services.lance.search(store.id, dummyVector, 10000);

      const exportData = {
        version: 1,
        store,
        documents: docs,
        exportedAt: new Date().toISOString(),
      };

      await writeFile(options.output, JSON.stringify(exportData, null, 2));
      console.log(`Exported ${docs.length} documents to ${options.output}`);
    });
}
```

**Step 2: Register command**

Update `src/index.ts`:
```typescript
import { createExportCommand } from './cli/commands/export.js';

program.addCommand(createExportCommand(() => getGlobalOptions(program)));
```

**Step 3: Commit**

```bash
git add src/cli/commands/export.ts src/index.ts
git commit -m "feat: add export command"
```

---

### Task E.2: Add import command

**Files:**
- Create: `src/cli/commands/import.ts`

**Step 1: Create import command**

Create `src/cli/commands/import.ts`:
```typescript
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { createServices } from '../../services/index.js';
import { createStoreId } from '../../types/brands.js';
import type { GlobalOptions } from '../program.js';

export function createImportCommand(getOptions: () => GlobalOptions): Command {
  return new Command('import')
    .description('Import store from file')
    .argument('<path>', 'Import file path')
    .requiredOption('-n, --name <name>', 'New store name')
    .action(async (path: string, options: { name: string }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const content = await readFile(path, 'utf-8');
      const data = JSON.parse(content);

      // Create new store with imported data
      const result = await services.store.create({
        name: options.name,
        type: data.store.type,
        path: data.store.path,
        url: data.store.url,
        description: `Imported from ${path}`,
      });

      if (!result.success) {
        console.error('Failed to create store:', result.error.message);
        process.exit(1);
      }

      const store = result.data;
      await services.lance.initialize(store.id);

      // Re-embed and add documents
      for (const doc of data.documents) {
        const vector = await services.embeddings.embed(doc.content);
        await services.lance.addDocuments(store.id, [{
          id: doc.id,
          content: doc.content,
          vector,
          metadata: { ...doc.metadata, storeId: store.id },
        }]);
      }

      console.log(`Imported ${data.documents.length} documents as "${options.name}"`);
    });
}
```

**Step 2: Register command**

Update `src/index.ts`:
```typescript
import { createImportCommand } from './cli/commands/import.js';

program.addCommand(createImportCommand(() => getGlobalOptions(program)));
```

**Step 3: Commit**

```bash
git add src/cli/commands/import.ts src/index.ts
git commit -m "feat: add import command"
```

---

## Final: Update exports and run tests

### Task F.1: Update all barrel exports

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/index.ts`
- Modify: `src/cli/index.ts`

**Step 1: Update types barrel**

Add to `src/types/index.ts`:
```typescript
export { type ProgressEvent, type ProgressCallback } from './progress.js';
```

**Step 2: Update services barrel**

Add to `src/services/index.ts`:
```typescript
export { ChunkingService } from './chunking.service.js';
export { WatchService } from './watch.service.js';
```

**Step 3: Update CLI barrel**

Add to `src/cli/index.ts`:
```typescript
export { createServeCommand } from './commands/serve.js';
export { createCrawlCommand } from './commands/crawl.js';
export { createExportCommand } from './commands/export.js';
export { createImportCommand } from './commands/import.js';
```

**Step 4: Run all tests**

```bash
npm run build && npm run test:run
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: complete Phase 2 features - all exports updated"
```

---

## Summary

**Total Tasks:** 15

**Group A - Search Improvements (4 tasks):**
- A.1: ChunkingService
- A.2: Integrate chunking into IndexService
- A.3: Full-text search in LanceStore
- A.4: Hybrid search with RRF

**Group B - User Experience (3 tasks):**
- B.1: Progress reporting
- B.2: Progress bars (ora)
- B.3: File watching

**Group C - HTTP Server (2 tasks):**
- C.1: Hono server
- C.2: Serve command

**Group D - Web Crawling (3 tasks):**
- D.1: Python crawl worker
- D.2: Python bridge
- D.3: Crawl command

**Group E - Export/Import (2 tasks):**
- E.1: Export command
- E.2: Import command

**Final (1 task):**
- F.1: Update exports and test
