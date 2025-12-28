# Bluera Knowledge CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a CLI tool for managing knowledge stores with semantic search capabilities, providing full feature parity with the existing VS Code extension.

**Architecture:** TypeScript primary with Python subprocess bridge for web crawling. Unified service layer shared between CLI and HTTP API. LanceDB for vector storage, Transformers.js for embeddings.

**Tech Stack:** TypeScript, Node.js, Commander.js, LanceDB, Transformers.js, Hono, Zod, crawl4ai (Python)

---

## Phase 1: Project Scaffolding

### Task 1.1: Initialize package.json

**Files:**
- Create: `package.json`

**Step 1: Create package.json**

```json
{
  "name": "bluera-knowledge",
  "version": "0.1.0",
  "description": "CLI tool for managing knowledge stores with semantic search",
  "type": "module",
  "bin": {
    "bluera-knowledge": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "keywords": ["knowledge", "semantic-search", "vector-database", "cli"],
  "author": "Bluera",
  "license": "MIT",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: initialize package.json"
```

---

### Task 1.2: Configure TypeScript

**Files:**
- Create: `tsconfig.json`

**Step 1: Create tsconfig.json with strict settings**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 2: Commit**

```bash
git add tsconfig.json
git commit -m "chore: configure TypeScript with strict settings"
```

---

### Task 1.3: Configure ESLint

**Files:**
- Create: `eslint.config.js`

**Step 1: Create eslint.config.js**

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js'],
  }
);
```

**Step 2: Commit**

```bash
git add eslint.config.js
git commit -m "chore: configure ESLint with strict TypeScript rules"
```

---

### Task 1.4: Configure tsup build

**Files:**
- Create: `tsup.config.ts`

**Step 1: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
  shims: true,
});
```

**Step 2: Commit**

```bash
git add tsup.config.ts
git commit -m "chore: configure tsup build"
```

---

### Task 1.5: Configure Vitest

**Files:**
- Create: `vitest.config.ts`

**Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
```

**Step 2: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: configure Vitest"
```

---

### Task 1.6: Update .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Update .gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.vscode/
*.local.md
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: update .gitignore"
```

---

### Task 1.7: Install dependencies

**Files:**
- Modify: `package.json` (lockfile created)

**Step 1: Install production dependencies**

```bash
npm install commander @lancedb/lancedb @huggingface/transformers chokidar hono @hono/node-server cli-table3 ora chalk zod
```

**Step 2: Install dev dependencies**

```bash
npm install -D typescript tsup vitest @types/node eslint @eslint/js typescript-eslint
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install dependencies"
```

---

### Task 1.8: Create directory structure

**Files:**
- Create: `src/index.ts`
- Create: `src/types/index.ts`
- Create: `src/services/index.ts`
- Create: `src/db/index.ts`
- Create: `src/cli/index.ts`
- Create: `src/server/index.ts`

**Step 1: Create src/index.ts (entry point)**

```typescript
#!/usr/bin/env node

console.log('bkb CLI');
```

**Step 2: Create empty module index files**

Create `src/types/index.ts`:
```typescript
// Types module - no external dependencies
export {};
```

Create `src/services/index.ts`:
```typescript
// Services module
export {};
```

Create `src/db/index.ts`:
```typescript
// Database module
export {};
```

Create `src/cli/index.ts`:
```typescript
// CLI module
export {};
```

Create `src/server/index.ts`:
```typescript
// Server module
export {};
```

**Step 3: Verify build works**

```bash
npm run build
```

Expected: Build succeeds, creates `dist/index.js`

**Step 4: Verify CLI runs**

```bash
node dist/index.js
```

Expected: Output `bkb CLI`

**Step 5: Commit**

```bash
git add src/
git commit -m "chore: create directory structure"
```

---

## Phase 2: Types Layer

### Task 2.1: Create branded types

**Files:**
- Create: `src/types/brands.ts`
- Create: `src/types/brands.test.ts`

**Step 1: Write the failing test**

Create `src/types/brands.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { createStoreId, createDocumentId, isStoreId, isDocumentId } from './brands.js';

describe('branded types', () => {
  describe('StoreId', () => {
    it('creates a valid store ID', () => {
      const id = createStoreId('store-123');
      expect(id).toBe('store-123');
    });

    it('validates store ID format', () => {
      expect(isStoreId('valid-store-id')).toBe(true);
      expect(isStoreId('')).toBe(false);
      expect(isStoreId('has spaces')).toBe(false);
    });
  });

  describe('DocumentId', () => {
    it('creates a valid document ID', () => {
      const id = createDocumentId('doc-456');
      expect(id).toBe('doc-456');
    });

    it('validates document ID format', () => {
      expect(isDocumentId('valid-doc-id')).toBe(true);
      expect(isDocumentId('')).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/types/brands.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/types/brands.ts`:
```typescript
// Branded type symbols
declare const StoreIdBrand: unique symbol;
declare const DocumentIdBrand: unique symbol;

// Branded types
export type StoreId = string & { readonly [StoreIdBrand]: typeof StoreIdBrand };
export type DocumentId = string & { readonly [DocumentIdBrand]: typeof DocumentIdBrand };

// Valid ID pattern: alphanumeric, hyphens, underscores
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isStoreId(value: string): value is StoreId {
  return value.length > 0 && ID_PATTERN.test(value);
}

export function isDocumentId(value: string): value is DocumentId {
  return value.length > 0 && ID_PATTERN.test(value);
}

export function createStoreId(value: string): StoreId {
  if (!isStoreId(value)) {
    throw new Error(`Invalid store ID: ${value}`);
  }
  return value;
}

export function createDocumentId(value: string): DocumentId {
  if (!isDocumentId(value)) {
    throw new Error(`Invalid document ID: ${value}`);
  }
  return value;
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/types/brands.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/types/brands.ts src/types/brands.test.ts
git commit -m "feat: add branded types for StoreId and DocumentId"
```

---

### Task 2.2: Create Result type

**Files:**
- Create: `src/types/result.ts`
- Create: `src/types/result.test.ts`

**Step 1: Write the failing test**

Create `src/types/result.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, unwrap, unwrapOr } from './result.js';

describe('Result type', () => {
  describe('ok', () => {
    it('creates a success result', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('err', () => {
    it('creates an error result', () => {
      const result = err(new Error('failed'));
      expect(isErr(result)).toBe(true);
      expect(isOk(result)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('returns value for success', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('throws for error', () => {
      const result = err(new Error('failed'));
      expect(() => unwrap(result)).toThrow('failed');
    });
  });

  describe('unwrapOr', () => {
    it('returns value for success', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('returns default for error', () => {
      const result = err(new Error('failed'));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/types/result.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/types/result.ts`:
```typescript
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success;
}

export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return !result.success;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(String(result.error));
}

export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/types/result.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/types/result.ts src/types/result.test.ts
git commit -m "feat: add Result type for error handling"
```

---

### Task 2.3: Create Store types

**Files:**
- Create: `src/types/store.ts`
- Create: `src/types/store.test.ts`

**Step 1: Write the failing test**

Create `src/types/store.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { isFileStore, isRepoStore, isWebStore } from './store.js';
import type { Store, FileStore, RepoStore, WebStore } from './store.js';
import { createStoreId } from './brands.js';

describe('Store types', () => {
  const fileStore: FileStore = {
    type: 'file',
    id: createStoreId('file-store'),
    name: 'My Files',
    path: '/path/to/files',
    description: 'Test file store',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const repoStore: RepoStore = {
    type: 'repo',
    id: createStoreId('repo-store'),
    name: 'My Repo',
    path: '/path/to/repo',
    branch: 'main',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const webStore: WebStore = {
    type: 'web',
    id: createStoreId('web-store'),
    name: 'Docs Site',
    url: 'https://docs.example.com',
    depth: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('isFileStore', () => {
    it('returns true for file stores', () => {
      expect(isFileStore(fileStore)).toBe(true);
    });

    it('returns false for other store types', () => {
      expect(isFileStore(repoStore)).toBe(false);
      expect(isFileStore(webStore)).toBe(false);
    });
  });

  describe('isRepoStore', () => {
    it('returns true for repo stores', () => {
      expect(isRepoStore(repoStore)).toBe(true);
    });

    it('returns false for other store types', () => {
      expect(isRepoStore(fileStore)).toBe(false);
      expect(isRepoStore(webStore)).toBe(false);
    });
  });

  describe('isWebStore', () => {
    it('returns true for web stores', () => {
      expect(isWebStore(webStore)).toBe(true);
    });

    it('returns false for other store types', () => {
      expect(isWebStore(fileStore)).toBe(false);
      expect(isWebStore(repoStore)).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/types/store.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/types/store.ts`:
```typescript
import type { StoreId } from './brands.js';

export type StoreType = 'file' | 'repo' | 'web';
export type StoreStatus = 'ready' | 'indexing' | 'error';

interface BaseStore {
  readonly id: StoreId;
  readonly name: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly status?: StoreStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface FileStore extends BaseStore {
  readonly type: 'file';
  readonly path: string;
}

export interface RepoStore extends BaseStore {
  readonly type: 'repo';
  readonly path: string;
  readonly branch?: string;
}

export interface WebStore extends BaseStore {
  readonly type: 'web';
  readonly url: string;
  readonly depth: number;
  readonly maxPages?: number;
}

export type Store = FileStore | RepoStore | WebStore;

export function isFileStore(store: Store): store is FileStore {
  return store.type === 'file';
}

export function isRepoStore(store: Store): store is RepoStore {
  return store.type === 'repo';
}

export function isWebStore(store: Store): store is WebStore {
  return store.type === 'web';
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/types/store.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/types/store.ts src/types/store.test.ts
git commit -m "feat: add Store discriminated union types"
```

---

### Task 2.4: Create Document types

**Files:**
- Create: `src/types/document.ts`

**Step 1: Create document types**

Create `src/types/document.ts`:
```typescript
import type { DocumentId, StoreId } from './brands.js';

export type DocumentType = 'file' | 'chunk' | 'web';

export interface DocumentMetadata {
  readonly path?: string;
  readonly url?: string;
  readonly type: DocumentType;
  readonly storeId: StoreId;
  readonly indexedAt: Date;
  readonly fileHash?: string;
  readonly chunkIndex?: number;
  readonly totalChunks?: number;
  readonly [key: string]: unknown;
}

export interface Document {
  readonly id: DocumentId;
  readonly content: string;
  readonly vector: readonly number[];
  readonly metadata: DocumentMetadata;
}

export interface DocumentChunk {
  readonly id: DocumentId;
  readonly content: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly metadata: DocumentMetadata;
}
```

**Step 2: Commit**

```bash
git add src/types/document.ts
git commit -m "feat: add Document types"
```

---

### Task 2.5: Create Search types

**Files:**
- Create: `src/types/search.ts`

**Step 1: Create search types**

Create `src/types/search.ts`:
```typescript
import type { StoreId, DocumentId } from './brands.js';
import type { DocumentMetadata } from './document.js';

export type SearchMode = 'vector' | 'fts' | 'hybrid';

export interface SearchQuery {
  readonly query: string;
  readonly stores?: readonly StoreId[];
  readonly mode?: SearchMode;
  readonly limit?: number;
  readonly threshold?: number;
  readonly filter?: Record<string, unknown>;
  readonly includeContent?: boolean;
  readonly contextLines?: number;
}

export interface SearchResult {
  readonly id: DocumentId;
  readonly score: number;
  readonly content: string;
  readonly highlight?: string;
  readonly metadata: DocumentMetadata;
}

export interface SearchResponse {
  readonly query: string;
  readonly mode: SearchMode;
  readonly stores: readonly StoreId[];
  readonly results: readonly SearchResult[];
  readonly totalResults: number;
  readonly timeMs: number;
}
```

**Step 2: Commit**

```bash
git add src/types/search.ts
git commit -m "feat: add Search types"
```

---

### Task 2.6: Create Config types

**Files:**
- Create: `src/types/config.ts`

**Step 1: Create config types**

Create `src/types/config.ts`:
```typescript
export interface EmbeddingConfig {
  readonly model: string;
  readonly batchSize: number;
  readonly dimensions: number;
}

export interface IndexingConfig {
  readonly concurrency: number;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly ignorePatterns: readonly string[];
}

export interface SearchConfig {
  readonly defaultMode: 'vector' | 'fts' | 'hybrid';
  readonly defaultLimit: number;
  readonly minScore: number;
  readonly rrf: {
    readonly k: number;
    readonly vectorWeight: number;
    readonly ftsWeight: number;
  };
}

export interface CrawlConfig {
  readonly userAgent: string;
  readonly timeout: number;
  readonly maxConcurrency: number;
}

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

export interface AppConfig {
  readonly version: number;
  readonly dataDir: string;
  readonly embedding: EmbeddingConfig;
  readonly indexing: IndexingConfig;
  readonly search: SearchConfig;
  readonly crawl: CrawlConfig;
  readonly server: ServerConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  dataDir: '~/.bluera/knowledge-data',
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2',
    batchSize: 32,
    dimensions: 384,
  },
  indexing: {
    concurrency: 4,
    chunkSize: 512,
    chunkOverlap: 50,
    ignorePatterns: ['node_modules/**', '.git/**', '*.min.js', '*.map'],
  },
  search: {
    defaultMode: 'hybrid',
    defaultLimit: 10,
    minScore: 0.5,
    rrf: {
      k: 60,
      vectorWeight: 0.7,
      ftsWeight: 0.3,
    },
  },
  crawl: {
    userAgent: 'BlueraKnowledge/1.0',
    timeout: 30000,
    maxConcurrency: 3,
  },
  server: {
    port: 3847,
    host: '127.0.0.1',
  },
};
```

**Step 2: Commit**

```bash
git add src/types/config.ts
git commit -m "feat: add Config types with defaults"
```

---

### Task 2.7: Create types barrel export

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Update types index**

Update `src/types/index.ts`:
```typescript
// Branded types
export {
  type StoreId,
  type DocumentId,
  createStoreId,
  createDocumentId,
  isStoreId,
  isDocumentId,
} from './brands.js';

// Result type
export {
  type Result,
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
} from './result.js';

// Store types
export {
  type Store,
  type FileStore,
  type RepoStore,
  type WebStore,
  type StoreType,
  type StoreStatus,
  isFileStore,
  isRepoStore,
  isWebStore,
} from './store.js';

// Document types
export {
  type Document,
  type DocumentChunk,
  type DocumentMetadata,
  type DocumentType,
} from './document.js';

// Search types
export {
  type SearchQuery,
  type SearchResult,
  type SearchResponse,
  type SearchMode,
} from './search.js';

// Config types
export {
  type AppConfig,
  type EmbeddingConfig,
  type IndexingConfig,
  type SearchConfig,
  type CrawlConfig,
  type ServerConfig,
  DEFAULT_CONFIG,
} from './config.js';
```

**Step 2: Run all type tests**

```bash
npm run test:run -- src/types/
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add types barrel export"
```

---

## Phase 3: Data Layer

### Task 3.1: Create embedding engine

**Files:**
- Create: `src/db/embeddings.ts`
- Create: `src/db/embeddings.test.ts`

**Step 1: Write the failing test**

Create `src/db/embeddings.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { EmbeddingEngine } from './embeddings.js';

describe('EmbeddingEngine', () => {
  let engine: EmbeddingEngine;

  beforeAll(async () => {
    engine = new EmbeddingEngine();
    await engine.initialize();
  }, 60000); // Allow time for model download

  it('generates embeddings for text', async () => {
    const embedding = await engine.embed('Hello world');
    expect(embedding).toHaveLength(384);
    expect(embedding.every((n) => typeof n === 'number')).toBe(true);
  });

  it('generates batch embeddings', async () => {
    const texts = ['Hello', 'World', 'Test'];
    const embeddings = await engine.embedBatch(texts);
    expect(embeddings).toHaveLength(3);
    expect(embeddings.every((e) => e.length === 384)).toBe(true);
  });

  it('produces similar embeddings for similar text', async () => {
    const emb1 = await engine.embed('The cat sat on the mat');
    const emb2 = await engine.embed('A cat was sitting on a rug');
    const emb3 = await engine.embed('Quantum physics is complex');

    const sim12 = cosineSimilarity(emb1, emb2);
    const sim13 = cosineSimilarity(emb1, emb3);

    expect(sim12).toBeGreaterThan(sim13);
  });
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/db/embeddings.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/db/embeddings.ts`:
```typescript
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export class EmbeddingEngine {
  private extractor: FeatureExtractionPipeline | null = null;
  private readonly modelName: string;
  private readonly dimensions: number;

  constructor(modelName = 'Xenova/all-MiniLM-L6-v2', dimensions = 384) {
    this.modelName = modelName;
    this.dimensions = dimensions;
  }

  async initialize(): Promise<void> {
    if (this.extractor !== null) return;
    this.extractor = await pipeline('feature-extraction', this.modelName, {
      dtype: 'fp32',
    });
  }

  async embed(text: string): Promise<number[]> {
    if (this.extractor === null) {
      await this.initialize();
    }
    const output = await this.extractor!(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data as Float32Array);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/db/embeddings.test.ts
```

Expected: PASS (may take time for model download on first run)

**Step 5: Commit**

```bash
git add src/db/embeddings.ts src/db/embeddings.test.ts
git commit -m "feat: add EmbeddingEngine with Transformers.js"
```

---

### Task 3.2: Create LanceDB wrapper

**Files:**
- Create: `src/db/lance.ts`
- Create: `src/db/lance.test.ts`

**Step 1: Write the failing test**

Create `src/db/lance.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LanceStore } from './lance.js';
import { createStoreId, createDocumentId } from '../types/brands.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('LanceStore', () => {
  let store: LanceStore;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lance-test-'));
    store = new LanceStore(tempDir);
    await store.initialize(storeId);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('adds and retrieves documents', async () => {
    const doc = {
      id: createDocumentId('doc-1'),
      content: 'Test content',
      vector: new Array(384).fill(0.1),
      metadata: {
        type: 'file' as const,
        storeId,
        indexedAt: new Date(),
        path: '/test/file.txt',
      },
    };

    await store.addDocuments(storeId, [doc]);

    const results = await store.search(storeId, new Array(384).fill(0.1), 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe('doc-1');
  });

  it('deletes documents', async () => {
    const docId = createDocumentId('doc-to-delete');
    const doc = {
      id: docId,
      content: 'Delete me',
      vector: new Array(384).fill(0.2),
      metadata: {
        type: 'file' as const,
        storeId,
        indexedAt: new Date(),
      },
    };

    await store.addDocuments(storeId, [doc]);
    await store.deleteDocuments(storeId, [docId]);

    const results = await store.search(storeId, new Array(384).fill(0.2), 10);
    const found = results.find((r) => r.id === 'doc-to-delete');
    expect(found).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/db/lance.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/db/lance.ts`:
```typescript
import * as lancedb from '@lancedb/lancedb';
import type { Table, Connection } from '@lancedb/lancedb';
import type { Document, DocumentMetadata } from '../types/document.js';
import type { StoreId, DocumentId } from '../types/brands.js';
import { createDocumentId } from '../types/brands.js';

interface LanceDocument {
  id: string;
  content: string;
  vector: number[];
  metadata: string; // JSON serialized
}

interface SearchHit {
  id: string;
  content: string;
  metadata: string;
  _distance: number;
}

export class LanceStore {
  private connection: Connection | null = null;
  private tables: Map<string, Table> = new Map();
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(storeId: StoreId): Promise<void> {
    if (this.connection === null) {
      this.connection = await lancedb.connect(this.dataDir);
    }

    const tableName = this.getTableName(storeId);
    const tableNames = await this.connection.tableNames();

    if (!tableNames.includes(tableName)) {
      // Create table with initial schema
      const table = await this.connection.createTable(tableName, [
        {
          id: '__init__',
          content: '',
          vector: new Array(384).fill(0),
          metadata: '{}',
        },
      ]);
      // Delete the init row
      await table.delete('id = "__init__"');
      this.tables.set(tableName, table);
    } else {
      const table = await this.connection.openTable(tableName);
      this.tables.set(tableName, table);
    }
  }

  async addDocuments(storeId: StoreId, documents: Document[]): Promise<void> {
    const table = await this.getTable(storeId);
    const lanceDocuments: LanceDocument[] = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      vector: [...doc.vector],
      metadata: JSON.stringify(doc.metadata),
    }));
    await table.add(lanceDocuments);
  }

  async deleteDocuments(storeId: StoreId, documentIds: DocumentId[]): Promise<void> {
    const table = await this.getTable(storeId);
    const idList = documentIds.map((id) => `"${id}"`).join(', ');
    await table.delete(`id IN (${idList})`);
  }

  async search(
    storeId: StoreId,
    vector: number[],
    limit: number,
    threshold?: number
  ): Promise<Array<{ id: DocumentId; content: string; score: number; metadata: DocumentMetadata }>> {
    const table = await this.getTable(storeId);
    let query = table.vectorSearch(vector).limit(limit);

    if (threshold !== undefined) {
      query = query.distanceType('cosine');
    }

    const results = (await query.toArray()) as SearchHit[];

    return results
      .filter((r) => {
        if (threshold === undefined) return true;
        const score = 1 - r._distance;
        return score >= threshold;
      })
      .map((r) => ({
        id: createDocumentId(r.id),
        content: r.content,
        score: 1 - r._distance,
        metadata: JSON.parse(r.metadata) as DocumentMetadata,
      }));
  }

  async deleteStore(storeId: StoreId): Promise<void> {
    const tableName = this.getTableName(storeId);
    if (this.connection !== null) {
      await this.connection.dropTable(tableName);
      this.tables.delete(tableName);
    }
  }

  private getTableName(storeId: StoreId): string {
    return `documents_${storeId}`;
  }

  private async getTable(storeId: StoreId): Promise<Table> {
    const tableName = this.getTableName(storeId);
    let table = this.tables.get(tableName);
    if (table === undefined) {
      await this.initialize(storeId);
      table = this.tables.get(tableName);
    }
    if (table === undefined) {
      throw new Error(`Table not found for store: ${storeId}`);
    }
    return table;
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
git commit -m "feat: add LanceDB wrapper for vector storage"
```

---

### Task 3.3: Update db barrel export

**Files:**
- Modify: `src/db/index.ts`

**Step 1: Update db index**

Update `src/db/index.ts`:
```typescript
export { EmbeddingEngine } from './embeddings.js';
export { LanceStore } from './lance.js';
```

**Step 2: Run all db tests**

```bash
npm run test:run -- src/db/
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add src/db/index.ts
git commit -m "feat: add db barrel export"
```

---

## Phase 4: Services Layer

### Task 4.1: Create ConfigService

**Files:**
- Create: `src/services/config.service.ts`
- Create: `src/services/config.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/config.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from './config.service.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('ConfigService', () => {
  let configService: ConfigService;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'config-test-'));
    configPath = join(tempDir, 'config.json');
    configService = new ConfigService(configPath, tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('loads default config when no file exists', async () => {
    const config = await configService.load();
    expect(config.version).toBe(1);
    expect(config.embedding.model).toBe('Xenova/all-MiniLM-L6-v2');
  });

  it('saves and loads config', async () => {
    const config = await configService.load();
    config.search.defaultLimit = 20;
    await configService.save(config);

    const loaded = await configService.load();
    expect(loaded.search.defaultLimit).toBe(20);
  });

  it('resolves data directory path', async () => {
    const config = await configService.load();
    const dataDir = configService.resolveDataDir();
    expect(dataDir).toBe(tempDir);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/config.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/services/config.service.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import type { AppConfig } from '../types/config.js';
import { DEFAULT_CONFIG } from '../types/config.js';

export class ConfigService {
  private readonly configPath: string;
  private readonly dataDir: string;
  private config: AppConfig | null = null;

  constructor(
    configPath = `${homedir()}/.bluera/knowledge.json`,
    dataDir?: string
  ) {
    this.configPath = configPath;
    this.dataDir = dataDir ?? this.expandPath(DEFAULT_CONFIG.dataDir);
  }

  async load(): Promise<AppConfig> {
    if (this.config !== null) {
      return this.config;
    }

    try {
      const content = await readFile(this.configPath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(content) } as AppConfig;
    } catch {
      this.config = { ...DEFAULT_CONFIG };
    }

    return this.config;
  }

  async save(config: AppConfig): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(config, null, 2));
    this.config = config;
  }

  resolveDataDir(): string {
    return this.dataDir;
  }

  private expandPath(path: string): string {
    if (path.startsWith('~')) {
      return path.replace('~', homedir());
    }
    return path;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/config.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/config.service.ts src/services/config.service.test.ts
git commit -m "feat: add ConfigService"
```

---

### Task 4.2: Create StoreService

**Files:**
- Create: `src/services/store.service.ts`
- Create: `src/services/store.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/store.service.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StoreService } from './store.service.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('StoreService', () => {
  let storeService: StoreService;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'store-test-'));
    storeService = new StoreService(tempDir);
    await storeService.initialize();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates a file store', async () => {
    const result = await storeService.create({
      name: 'My Files',
      type: 'file',
      path: '/path/to/files',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('My Files');
      expect(result.data.type).toBe('file');
    }
  });

  it('lists all stores', async () => {
    await storeService.create({ name: 'Store 1', type: 'file', path: '/path/1' });
    await storeService.create({ name: 'Store 2', type: 'repo', path: '/path/2' });

    const stores = await storeService.list();
    expect(stores).toHaveLength(2);
  });

  it('gets store by ID', async () => {
    const createResult = await storeService.create({
      name: 'Test Store',
      type: 'file',
      path: '/path/test',
    });

    if (!createResult.success) throw new Error('Create failed');

    const store = await storeService.get(createResult.data.id);
    expect(store?.name).toBe('Test Store');
  });

  it('gets store by name', async () => {
    await storeService.create({
      name: 'Named Store',
      type: 'file',
      path: '/path/named',
    });

    const store = await storeService.getByName('Named Store');
    expect(store?.name).toBe('Named Store');
  });

  it('deletes a store', async () => {
    const createResult = await storeService.create({
      name: 'To Delete',
      type: 'file',
      path: '/path/delete',
    });

    if (!createResult.success) throw new Error('Create failed');

    const deleteResult = await storeService.delete(createResult.data.id);
    expect(deleteResult.success).toBe(true);

    const stores = await storeService.list();
    expect(stores).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/store.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/services/store.service.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Store, FileStore, RepoStore, WebStore, StoreType } from '../types/store.js';
import type { StoreId } from '../types/brands.js';
import { createStoreId } from '../types/brands.js';
import type { Result } from '../types/result.js';
import { ok, err } from '../types/result.js';

interface CreateStoreInput {
  name: string;
  type: StoreType;
  path?: string;
  url?: string;
  description?: string;
  tags?: string[];
  branch?: string;
  depth?: number;
}

interface StoreRegistry {
  stores: Store[];
}

export class StoreService {
  private readonly dataDir: string;
  private registry: StoreRegistry = { stores: [] };

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadRegistry();
  }

  async create(input: CreateStoreInput): Promise<Result<Store>> {
    const existing = await this.getByName(input.name);
    if (existing !== undefined) {
      return err(new Error(`Store with name "${input.name}" already exists`));
    }

    const id = createStoreId(randomUUID());
    const now = new Date();

    let store: Store;

    switch (input.type) {
      case 'file':
        if (input.path === undefined) {
          return err(new Error('Path is required for file stores'));
        }
        store = {
          type: 'file',
          id,
          name: input.name,
          path: input.path,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies FileStore;
        break;

      case 'repo':
        if (input.path === undefined) {
          return err(new Error('Path is required for repo stores'));
        }
        store = {
          type: 'repo',
          id,
          name: input.name,
          path: input.path,
          branch: input.branch,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies RepoStore;
        break;

      case 'web':
        if (input.url === undefined) {
          return err(new Error('URL is required for web stores'));
        }
        store = {
          type: 'web',
          id,
          name: input.name,
          url: input.url,
          depth: input.depth ?? 1,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies WebStore;
        break;
    }

    this.registry.stores.push(store);
    await this.saveRegistry();

    return ok(store);
  }

  async list(type?: StoreType): Promise<Store[]> {
    if (type !== undefined) {
      return this.registry.stores.filter((s) => s.type === type);
    }
    return [...this.registry.stores];
  }

  async get(id: StoreId): Promise<Store | undefined> {
    return this.registry.stores.find((s) => s.id === id);
  }

  async getByName(name: string): Promise<Store | undefined> {
    return this.registry.stores.find((s) => s.name === name);
  }

  async getByIdOrName(idOrName: string): Promise<Store | undefined> {
    return this.registry.stores.find((s) => s.id === idOrName || s.name === idOrName);
  }

  async update(id: StoreId, updates: Partial<Pick<Store, 'name' | 'description' | 'tags'>>): Promise<Result<Store>> {
    const index = this.registry.stores.findIndex((s) => s.id === id);
    if (index === -1) {
      return err(new Error(`Store not found: ${id}`));
    }

    const store = this.registry.stores[index]!;
    const updated = {
      ...store,
      ...updates,
      updatedAt: new Date(),
    } as Store;

    this.registry.stores[index] = updated;
    await this.saveRegistry();

    return ok(updated);
  }

  async delete(id: StoreId): Promise<Result<void>> {
    const index = this.registry.stores.findIndex((s) => s.id === id);
    if (index === -1) {
      return err(new Error(`Store not found: ${id}`));
    }

    this.registry.stores.splice(index, 1);
    await this.saveRegistry();

    return ok(undefined);
  }

  private async loadRegistry(): Promise<void> {
    const registryPath = join(this.dataDir, 'stores.json');
    try {
      const content = await readFile(registryPath, 'utf-8');
      const data = JSON.parse(content) as { stores: Store[] };
      this.registry = {
        stores: data.stores.map((s) => ({
          ...s,
          id: createStoreId(s.id),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      };
    } catch {
      this.registry = { stores: [] };
    }
  }

  private async saveRegistry(): Promise<void> {
    const registryPath = join(this.dataDir, 'stores.json');
    await writeFile(registryPath, JSON.stringify(this.registry, null, 2));
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/store.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/store.service.ts src/services/store.service.test.ts
git commit -m "feat: add StoreService for store CRUD operations"
```

---

### Task 4.3: Create SearchService

**Files:**
- Create: `src/services/search.service.ts`
- Create: `src/services/search.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/search.service.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SearchService } from './search.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';
import { createStoreId, createDocumentId } from '../types/brands.js';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('SearchService', () => {
  let searchService: SearchService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'search-test-'));
    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    // Add test documents
    const texts = [
      'TypeScript is a typed superset of JavaScript',
      'Python is great for machine learning',
      'React is a JavaScript library for building user interfaces',
    ];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i]!;
      const vector = await embeddingEngine.embed(text);
      await lanceStore.addDocuments(storeId, [
        {
          id: createDocumentId(`doc-${i}`),
          content: text,
          vector,
          metadata: {
            type: 'file',
            storeId,
            indexedAt: new Date(),
          },
        },
      ]);
    }

    searchService = new SearchService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('searches with vector mode', async () => {
    const results = await searchService.search({
      query: 'JavaScript programming',
      stores: [storeId],
      mode: 'vector',
      limit: 10,
    });

    expect(results.results.length).toBeGreaterThan(0);
    expect(results.mode).toBe('vector');
  });

  it('returns results with scores', async () => {
    const results = await searchService.search({
      query: 'machine learning Python',
      stores: [storeId],
      mode: 'vector',
      limit: 10,
    });

    expect(results.results[0]?.score).toBeGreaterThan(0);
    expect(results.results[0]?.content).toContain('Python');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/search.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/services/search.service.ts`:
```typescript
import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { SearchQuery, SearchResponse, SearchResult } from '../types/search.js';
import type { StoreId } from '../types/brands.js';

export class SearchService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;

  constructor(lanceStore: LanceStore, embeddingEngine: EmbeddingEngine) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const mode = query.mode ?? 'hybrid';
    const limit = query.limit ?? 10;
    const stores = query.stores ?? [];

    let allResults: SearchResult[] = [];

    if (mode === 'vector' || mode === 'hybrid') {
      const queryVector = await this.embeddingEngine.embed(query.query);

      for (const storeId of stores) {
        const results = await this.lanceStore.search(
          storeId,
          queryVector,
          limit,
          query.threshold
        );

        allResults.push(
          ...results.map((r) => ({
            id: r.id,
            score: r.score,
            content: r.content,
            metadata: r.metadata,
          }))
        );
      }
    }

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score);

    // Limit results
    allResults = allResults.slice(0, limit);

    return {
      query: query.query,
      mode,
      stores,
      results: allResults,
      totalResults: allResults.length,
      timeMs: Date.now() - startTime,
    };
  }

  async searchAllStores(
    query: SearchQuery,
    storeIds: StoreId[]
  ): Promise<SearchResponse> {
    return this.search({
      ...query,
      stores: storeIds,
    });
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/search.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/search.service.ts src/services/search.service.test.ts
git commit -m "feat: add SearchService for vector search"
```

---

### Task 4.4: Create IndexService (simplified)

**Files:**
- Create: `src/services/index.service.ts`
- Create: `src/services/index.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/index.service.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IndexService } from './index.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';
import { createStoreId } from '../types/brands.js';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileStore } from '../types/store.js';

describe('IndexService', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    // Create test files
    await writeFile(join(testFilesDir, 'test1.txt'), 'Hello world, this is a test file.');
    await writeFile(join(testFilesDir, 'test2.md'), '# Heading\n\nSome markdown content here.');

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('indexes a file store', async () => {
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
      expect(result.data.documentsIndexed).toBeGreaterThan(0);
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/services/index.service.test.ts
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/services/index.service.ts`:
```typescript
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

interface IndexResult {
  documentsIndexed: number;
  chunksCreated: number;
  timeMs: number;
}

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.yaml', '.yml',
  '.html', '.css', '.scss', '.less', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.sh', '.bash', '.zsh', '.sql', '.xml',
]);

export class IndexService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;

  constructor(lanceStore: LanceStore, embeddingEngine: EmbeddingEngine) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
  }

  async indexStore(store: Store): Promise<Result<IndexResult>> {
    const startTime = Date.now();

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

    for (const filePath of files) {
      const content = await readFile(filePath, 'utf-8');
      const vector = await this.embeddingEngine.embed(content);
      const fileHash = createHash('md5').update(content).digest('hex');

      const doc: Document = {
        id: createDocumentId(`${store.id}-${fileHash}`),
        content,
        vector,
        metadata: {
          type: 'file',
          storeId: store.id,
          path: filePath,
          indexedAt: new Date(),
          fileHash,
        },
      };

      documents.push(doc);
    }

    if (documents.length > 0) {
      await this.lanceStore.addDocuments(store.id, documents);
    }

    return ok({
      documentsIndexed: documents.length,
      chunksCreated: documents.length, // Simplified - no chunking yet
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
```

**Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/services/index.service.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/services/index.service.ts src/services/index.service.test.ts
git commit -m "feat: add IndexService for file indexing"
```

---

### Task 4.5: Create ServiceContainer

**Files:**
- Modify: `src/services/index.ts`

**Step 1: Create ServiceContainer**

Update `src/services/index.ts`:
```typescript
import { ConfigService } from './config.service.js';
import { StoreService } from './store.service.js';
import { SearchService } from './search.service.js';
import { IndexService } from './index.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';

export { ConfigService } from './config.service.js';
export { StoreService } from './store.service.js';
export { SearchService } from './search.service.js';
export { IndexService } from './index.service.js';

export interface ServiceContainer {
  config: ConfigService;
  store: StoreService;
  search: SearchService;
  index: IndexService;
  lance: LanceStore;
  embeddings: EmbeddingEngine;
}

export async function createServices(
  configPath?: string,
  dataDir?: string
): Promise<ServiceContainer> {
  const config = new ConfigService(configPath, dataDir);
  const appConfig = await config.load();
  const resolvedDataDir = config.resolveDataDir();

  const lance = new LanceStore(resolvedDataDir);
  const embeddings = new EmbeddingEngine(
    appConfig.embedding.model,
    appConfig.embedding.dimensions
  );

  await embeddings.initialize();

  const store = new StoreService(resolvedDataDir);
  await store.initialize();

  const search = new SearchService(lance, embeddings);
  const index = new IndexService(lance, embeddings);

  return {
    config,
    store,
    search,
    index,
    lance,
    embeddings,
  };
}
```

**Step 2: Commit**

```bash
git add src/services/index.ts
git commit -m "feat: add ServiceContainer for dependency injection"
```

---

## Phase 5: CLI Layer

### Task 5.1: Create CLI framework

**Files:**
- Create: `src/cli/program.ts`
- Modify: `src/index.ts`

**Step 1: Create CLI program**

Create `src/cli/program.ts`:
```typescript
import { Command } from 'commander';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('bluera-knowledge')
    .description('CLI tool for managing knowledge stores with semantic search')
    .version('0.1.0');

  program
    .option('-c, --config <path>', 'Path to config file')
    .option('-d, --data-dir <path>', 'Data directory')
    .option('-f, --format <format>', 'Output format: json | table | plain', 'table')
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-v, --verbose', 'Enable verbose logging');

  return program;
}

export interface GlobalOptions {
  config?: string;
  dataDir?: string;
  format: 'json' | 'table' | 'plain';
  quiet?: boolean;
  verbose?: boolean;
}

export function getGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts<GlobalOptions>();
  return {
    config: opts.config,
    dataDir: opts.dataDir,
    format: opts.format ?? 'table',
    quiet: opts.quiet,
    verbose: opts.verbose,
  };
}
```

**Step 2: Update entry point**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node

import { createProgram } from './cli/program.js';

const program = createProgram();

program.parse();
```

**Step 3: Verify CLI works**

```bash
npm run build && node dist/index.js --help
```

Expected: Help output with description and options

**Step 4: Commit**

```bash
git add src/cli/program.ts src/index.ts
git commit -m "feat: add CLI framework with Commander.js"
```

---

### Task 5.2: Add store commands

**Files:**
- Create: `src/cli/commands/store.ts`
- Modify: `src/index.ts`

**Step 1: Create store commands**

Create `src/cli/commands/store.ts`:
```typescript
import { Command } from 'commander';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';
import type { StoreType } from '../../types/store.js';

export function createStoreCommand(getOptions: () => GlobalOptions): Command {
  const store = new Command('store').description('Manage knowledge stores');

  store
    .command('list')
    .description('List all stores')
    .option('-t, --type <type>', 'Filter by store type (file, repo, web)')
    .action(async (options: { type?: StoreType }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const stores = await services.store.list(options.type);

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(stores, null, 2));
      } else {
        if (stores.length === 0) {
          console.log('No stores found.');
        } else {
          console.log('\nStores:\n');
          for (const s of stores) {
            console.log(`  ${s.name} (${s.type}) - ${s.id}`);
          }
          console.log('');
        }
      }
    });

  store
    .command('create <name>')
    .description('Create a new store')
    .requiredOption('-t, --type <type>', 'Store type (file, repo, web)')
    .requiredOption('-s, --source <path>', 'Source path or URL')
    .option('-d, --description <desc>', 'Store description')
    .option('--tags <tags>', 'Comma-separated tags')
    .action(async (name: string, options: {
      type: StoreType;
      source: string;
      description?: string;
      tags?: string;
    }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      const result = await services.store.create({
        name,
        type: options.type,
        path: options.type !== 'web' ? options.source : undefined,
        url: options.type === 'web' ? options.source : undefined,
        description: options.description,
        tags: options.tags?.split(',').map((t) => t.trim()),
      });

      if (result.success) {
        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(`\nCreated store: ${result.data.name} (${result.data.id})\n`);
        }
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
    });

  store
    .command('info <store>')
    .description('Show store details')
    .action(async (storeIdOrName: string) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const s = await services.store.getByIdOrName(storeIdOrName);

      if (s === undefined) {
        console.error(`Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(s, null, 2));
      } else {
        console.log(`\nStore: ${s.name}`);
        console.log(`  ID: ${s.id}`);
        console.log(`  Type: ${s.type}`);
        if ('path' in s) console.log(`  Path: ${s.path}`);
        if ('url' in s) console.log(`  URL: ${s.url}`);
        if (s.description !== undefined) console.log(`  Description: ${s.description}`);
        console.log(`  Created: ${s.createdAt.toISOString()}`);
        console.log(`  Updated: ${s.updatedAt.toISOString()}`);
        console.log('');
      }
    });

  store
    .command('delete <store>')
    .description('Delete a store')
    .option('-f, --force', 'Skip confirmation')
    .action(async (storeIdOrName: string, options: { force?: boolean }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);
      const s = await services.store.getByIdOrName(storeIdOrName);

      if (s === undefined) {
        console.error(`Store not found: ${storeIdOrName}`);
        process.exit(3);
      }

      const result = await services.store.delete(s.id);

      if (result.success) {
        console.log(`Deleted store: ${s.name}`);
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(1);
      }
    });

  return store;
}
```

**Step 2: Register store command**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node

import { createProgram, getGlobalOptions } from './cli/program.js';
import { createStoreCommand } from './cli/commands/store.js';

const program = createProgram();

program.addCommand(createStoreCommand(() => getGlobalOptions(program)));

program.parse();
```

**Step 3: Verify store commands work**

```bash
npm run build && node dist/index.js store --help
```

Expected: Help output for store commands

**Step 4: Commit**

```bash
git add src/cli/commands/store.ts src/index.ts
git commit -m "feat: add store CLI commands"
```

---

### Task 5.3: Add search command

**Files:**
- Create: `src/cli/commands/search.ts`
- Modify: `src/index.ts`

**Step 1: Create search command**

Create `src/cli/commands/search.ts`:
```typescript
import { Command } from 'commander';
import { createServices } from '../../services/index.js';
import type { GlobalOptions } from '../program.js';
import type { SearchMode } from '../../types/search.js';
import { createStoreId } from '../../types/brands.js';

export function createSearchCommand(getOptions: () => GlobalOptions): Command {
  const search = new Command('search')
    .description('Search across knowledge stores')
    .argument('<query>', 'Search query')
    .option('-s, --stores <stores>', 'Comma-separated store IDs/names')
    .option('-m, --mode <mode>', 'Search mode: vector | fts | hybrid', 'hybrid')
    .option('-n, --limit <number>', 'Max results', '10')
    .option('-t, --threshold <number>', 'Minimum relevance score 0-1')
    .option('--include-content', 'Include full content in results')
    .action(async (query: string, options: {
      stores?: string;
      mode?: SearchMode;
      limit?: string;
      threshold?: string;
      includeContent?: boolean;
    }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      // Get store IDs
      let storeIds = (await services.store.list()).map((s) => s.id);

      if (options.stores !== undefined) {
        const requestedStores = options.stores.split(',').map((s) => s.trim());
        const resolvedStores = [];

        for (const requested of requestedStores) {
          const store = await services.store.getByIdOrName(requested);
          if (store !== undefined) {
            resolvedStores.push(store.id);
          } else {
            console.error(`Store not found: ${requested}`);
            process.exit(3);
          }
        }

        storeIds = resolvedStores;
      }

      if (storeIds.length === 0) {
        console.error('No stores to search. Create a store first.');
        process.exit(1);
      }

      // Initialize LanceDB for each store
      for (const storeId of storeIds) {
        await services.lance.initialize(storeId);
      }

      const results = await services.search.search({
        query,
        stores: storeIds,
        mode: options.mode ?? 'hybrid',
        limit: parseInt(options.limit ?? '10', 10),
        threshold: options.threshold !== undefined ? parseFloat(options.threshold) : undefined,
        includeContent: options.includeContent,
      });

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`\nSearch: "${query}"`);
        console.log(`Mode: ${results.mode} | Stores: ${results.stores.length} | Results: ${results.totalResults} | Time: ${results.timeMs}ms\n`);

        if (results.results.length === 0) {
          console.log('No results found.\n');
        } else {
          for (let i = 0; i < results.results.length; i++) {
            const r = results.results[i]!;
            const path = r.metadata.path ?? r.metadata.url ?? 'unknown';
            console.log(`${i + 1}. [${r.score.toFixed(2)}] ${path}`);
            const preview = r.content.slice(0, 150).replace(/\n/g, ' ');
            console.log(`   ${preview}${r.content.length > 150 ? '...' : ''}\n`);
          }
        }
      }
    });

  return search;
}
```

**Step 2: Register search command**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node

import { createProgram, getGlobalOptions } from './cli/program.js';
import { createStoreCommand } from './cli/commands/store.js';
import { createSearchCommand } from './cli/commands/search.js';

const program = createProgram();

program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));

program.parse();
```

**Step 3: Commit**

```bash
git add src/cli/commands/search.ts src/index.ts
git commit -m "feat: add search CLI command"
```

---

### Task 5.4: Add index command

**Files:**
- Create: `src/cli/commands/index-cmd.ts`
- Modify: `src/index.ts`

**Step 1: Create index command**

Create `src/cli/commands/index-cmd.ts`:
```typescript
import { Command } from 'commander';
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

      console.log(`\nIndexing store: ${store.name}...\n`);

      await services.lance.initialize(store.id);

      const result = await services.index.indexStore(store);

      if (result.success) {
        if (globalOpts.format === 'json') {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          console.log(`Indexed ${result.data.documentsIndexed} documents`);
          console.log(`Created ${result.data.chunksCreated} chunks`);
          console.log(`Time: ${result.data.timeMs}ms\n`);
        }
      } else {
        console.error(`Error: ${result.error.message}`);
        process.exit(4);
      }
    });

  return index;
}
```

**Step 2: Register index command**

Update `src/index.ts`:
```typescript
#!/usr/bin/env node

import { createProgram, getGlobalOptions } from './cli/program.js';
import { createStoreCommand } from './cli/commands/store.js';
import { createSearchCommand } from './cli/commands/search.js';
import { createIndexCommand } from './cli/commands/index-cmd.js';

const program = createProgram();

program.addCommand(createStoreCommand(() => getGlobalOptions(program)));
program.addCommand(createSearchCommand(() => getGlobalOptions(program)));
program.addCommand(createIndexCommand(() => getGlobalOptions(program)));

program.parse();
```

**Step 3: Commit**

```bash
git add src/cli/commands/index-cmd.ts src/index.ts
git commit -m "feat: add index CLI command"
```

---

### Task 5.5: Update CLI barrel export

**Files:**
- Modify: `src/cli/index.ts`

**Step 1: Update CLI index**

Update `src/cli/index.ts`:
```typescript
export { createProgram, getGlobalOptions, type GlobalOptions } from './program.js';
export { createStoreCommand } from './commands/store.js';
export { createSearchCommand } from './commands/search.js';
export { createIndexCommand } from './commands/index-cmd.js';
```

**Step 2: Run full build and test**

```bash
npm run build && npm run test:run
```

Expected: All tests pass, build succeeds

**Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat: add CLI barrel export"
```

---

## Phase 6: Integration Testing

### Task 6.1: Create end-to-end test

**Files:**
- Create: `tests/integration/cli.test.ts`

**Step 1: Write integration test**

Create `tests/integration/cli.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { rm, mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('CLI Integration', () => {
  let tempDir: string;
  let testFilesDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(
      join(testFilesDir, 'test.md'),
      '# Test Document\n\nThis is content about TypeScript and JavaScript programming.'
    );
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const cli = (args: string): string => {
    return execSync(`node dist/index.js ${args} --data-dir "${tempDir}"`, {
      encoding: 'utf-8',
      timeout: 120000,
    });
  };

  it('shows help', () => {
    const output = cli('--help');
    expect(output).toContain('bkb');
    expect(output).toContain('CLI tool for managing knowledge stores');
  });

  it('creates and lists stores', () => {
    cli(`store create test-store --type file --source "${testFilesDir}"`);
    const listOutput = cli('store list');
    expect(listOutput).toContain('test-store');
  });

  it('shows store info', () => {
    const output = cli('store info test-store');
    expect(output).toContain('test-store');
    expect(output).toContain('file');
  });

  it('indexes a store', () => {
    const output = cli('index test-store');
    expect(output).toContain('Indexed');
    expect(output).toContain('documents');
  }, 120000);

  it('searches indexed content', () => {
    const output = cli('search "TypeScript programming"');
    expect(output).toContain('Search:');
    expect(output).toContain('Results:');
  }, 60000);
});
```

**Step 2: Run integration tests**

```bash
npm run build && npm run test:run -- tests/integration/
```

Expected: All integration tests pass

**Step 3: Commit**

```bash
git add tests/integration/cli.test.ts
git commit -m "test: add CLI integration tests"
```

---

## Summary

This plan covers the core implementation of the Bluera Knowledge CLI:

**Phase 1:** Project scaffolding (8 tasks)
**Phase 2:** Types layer (7 tasks)
**Phase 3:** Data layer (3 tasks)
**Phase 4:** Services layer (5 tasks)
**Phase 5:** CLI layer (5 tasks)
**Phase 6:** Integration testing (1 task)

**Total: 29 bite-sized tasks**

**Not included in this initial plan (future phases):**
- HTTP server mode (Hono)
- Python bridge for web crawling
- Document chunking
- Full-text search
- Hybrid search with RRF
- Progress bars and interactive mode
- File watching
- Export/import functionality

These can be added in subsequent plans once the core is working.
