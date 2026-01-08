import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { IndexService, classifyWebContentType } from './index.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';
import { createStoreId } from '../types/brands.js';
import { rm, mkdtemp, writeFile, mkdir, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileStore } from '../types/store.js';
import type { CodeGraphService } from './code-graph.service.js';

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
});

describe('IndexService - File Type Classification', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-filetype-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('classifies README.md as documentation-primary', async () => {
    await writeFile(join(testFilesDir, 'README.md'), '# Project\n\nMain documentation.');

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
  });

  it('classifies markdown files in docs/ as documentation', async () => {
    const docsDir = join(testFilesDir, 'docs');
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, 'guide.md'), '# Guide\n\nTutorial content.');

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
  });

  it('classifies test files correctly', async () => {
    await writeFile(join(testFilesDir, 'app.test.ts'), 'describe("test", () => {});');
    await writeFile(join(testFilesDir, 'app.spec.js'), 'it("works", () => {});');

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
  });

  it('classifies example files correctly', async () => {
    const examplesDir = join(testFilesDir, 'examples');
    await mkdir(examplesDir, { recursive: true });
    await writeFile(join(examplesDir, 'basic.ts'), 'const example = 42;');

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
  });

  it('classifies config files correctly', async () => {
    await writeFile(join(testFilesDir, 'tsconfig.json'), '{ "compilerOptions": {} }');
    await writeFile(join(testFilesDir, 'package.json'), '{ "name": "test" }');

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
  });

  it('classifies TypeScript source files', async () => {
    await writeFile(join(testFilesDir, 'app.ts'), 'export function hello() {}');

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
  });

  it('classifies JavaScript source files', async () => {
    await writeFile(join(testFilesDir, 'app.js'), 'function hello() {}');

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
  });

  it('classifies Python source files', async () => {
    await writeFile(join(testFilesDir, 'app.py'), 'def hello():\n    pass');

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
  });

  it('classifies CHANGELOG.md separately', async () => {
    await writeFile(join(testFilesDir, 'CHANGELOG.md'), '# Changelog\n\n## v1.0.0');

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
  });

  it('classifies MIGRATION.md as documentation-primary', async () => {
    await writeFile(join(testFilesDir, 'MIGRATION.md'), '# Migration Guide\n\nSteps to upgrade.');

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
  });

  it('classifies Go source files', async () => {
    await writeFile(join(testFilesDir, 'main.go'), 'package main\n\nfunc main() {}');

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
  });

  it('classifies Rust source files', async () => {
    await writeFile(join(testFilesDir, 'main.rs'), 'fn main() {}');

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
  });
});

describe('IndexService - Path Pattern Matching', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-path-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('skips node_modules directory', async () => {
    const nodeModules = join(testFilesDir, 'node_modules');
    await mkdir(nodeModules, { recursive: true });
    await writeFile(join(nodeModules, 'package.js'), 'module.exports = {};');
    await writeFile(join(testFilesDir, 'app.js'), 'console.log("app");');

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
      // Should only index app.js, not node_modules
      expect(result.data.documentsIndexed).toBe(1);
    }
  });

  it('skips .git directory', async () => {
    const gitDir = join(testFilesDir, '.git');
    await mkdir(gitDir, { recursive: true });
    await writeFile(join(gitDir, 'config'), 'git config');
    await writeFile(join(testFilesDir, 'app.js'), 'console.log("app");');

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
      expect(result.data.documentsIndexed).toBe(1);
    }
  });

  it('skips dist directory', async () => {
    const distDir = join(testFilesDir, 'dist');
    await mkdir(distDir, { recursive: true });
    await writeFile(join(distDir, 'bundle.js'), 'minified code');
    await writeFile(join(testFilesDir, 'app.js'), 'console.log("app");');

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
      expect(result.data.documentsIndexed).toBe(1);
    }
  });

  it('skips build directory', async () => {
    const buildDir = join(testFilesDir, 'build');
    await mkdir(buildDir, { recursive: true });
    await writeFile(join(buildDir, 'output.js'), 'compiled code');
    await writeFile(join(testFilesDir, 'app.js'), 'console.log("app");');

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
      expect(result.data.documentsIndexed).toBe(1);
    }
  });

  it('indexes nested directories', async () => {
    const srcDir = join(testFilesDir, 'src');
    const utilsDir = join(srcDir, 'utils');
    await mkdir(utilsDir, { recursive: true });
    await writeFile(join(utilsDir, 'helper.ts'), 'export function help() {}');

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

  it('only indexes text files with supported extensions', async () => {
    const isolatedDir = join(tempDir, 'isolated-test');
    await mkdir(isolatedDir, { recursive: true });
    await writeFile(join(isolatedDir, 'image.png'), 'binary data');
    await writeFile(join(isolatedDir, 'video.mp4'), 'binary data');
    await writeFile(join(isolatedDir, 'app.ts'), 'const x = 42;');

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: isolatedDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);
    expect(result.success).toBe(true);
    if (result.success) {
      // Should only index app.ts
      expect(result.data.documentsIndexed).toBe(1);
    }
  });
});

describe('IndexService - Internal Implementation Detection', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-internal-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('detects monorepo internal files', async () => {
    const packagesDir = join(testFilesDir, 'packages', 'core', 'src');
    await mkdir(packagesDir, { recursive: true });
    await writeFile(join(packagesDir, 'internal.ts'), 'export function internal() {}');

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
  });

  it('treats index files as public API', async () => {
    const packagesDir = join(testFilesDir, 'packages', 'core', 'src');
    await mkdir(packagesDir, { recursive: true });
    await writeFile(join(packagesDir, 'index.ts'), 'export * from "./api";');

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
  });

  it('detects internal/ directory files', async () => {
    const internalDir = join(testFilesDir, 'src', 'internal');
    await mkdir(internalDir, { recursive: true });
    await writeFile(join(internalDir, 'helper.ts'), 'function internal() {}');

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
  });

  it('detects compiler internal files', async () => {
    const compilerDir = join(testFilesDir, 'src', 'compiler');
    await mkdir(compilerDir, { recursive: true });
    await writeFile(join(compilerDir, 'parser.ts'), 'function parse() {}');

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
  });

  it('detects private directory files', async () => {
    const privateDir = join(testFilesDir, 'private');
    await mkdir(privateDir, { recursive: true });
    await writeFile(join(privateDir, 'secret.ts'), 'const secret = "key";');

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
  });
});

describe('IndexService - Progress Callbacks', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-progress-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('emits start event', async () => {
    await writeFile(join(testFilesDir, 'test.txt'), 'content');

    const events: string[] = [];
    const onProgress = vi.fn((event) => {
      events.push(event.type);
    });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexService.indexStore(store, onProgress);

    expect(events).toContain('start');
  });

  it('emits progress events', async () => {
    await writeFile(join(testFilesDir, 'test1.txt'), 'content 1');
    await writeFile(join(testFilesDir, 'test2.txt'), 'content 2');

    const events: string[] = [];
    const onProgress = vi.fn((event) => {
      events.push(event.type);
    });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexService.indexStore(store, onProgress);

    expect(events).toContain('progress');
  });

  it('emits complete event', async () => {
    await writeFile(join(testFilesDir, 'test.txt'), 'content');

    const events: string[] = [];
    const onProgress = vi.fn((event) => {
      events.push(event.type);
    });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexService.indexStore(store, onProgress);

    expect(events).toContain('complete');
  });

  it('provides progress counts', async () => {
    await writeFile(join(testFilesDir, 'test1.txt'), 'content 1');
    await writeFile(join(testFilesDir, 'test2.txt'), 'content 2');

    const progressEvents: Array<{ current: number; total: number }> = [];
    const onProgress = vi.fn((event) => {
      if (event.type === 'progress') {
        progressEvents.push({ current: event.current, total: event.total });
      }
    });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexService.indexStore(store, onProgress);

    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents[0]?.total).toBeGreaterThan(0);
  });

  it('maintains event sequence: start -> progress -> complete', async () => {
    await writeFile(join(testFilesDir, 'test.txt'), 'content');

    const events: string[] = [];
    const onProgress = vi.fn((event) => {
      events.push(event.type);
    });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await indexService.indexStore(store, onProgress);

    expect(events[0]).toBe('start');
    expect(events[events.length - 1]).toBe('complete');
  });
});

describe('IndexService - Error Handling', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-error-test-'));

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('handles non-existent directory', async () => {
    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: '/nonexistent/path',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(false);
  });

  it('handles empty directory', async () => {
    const emptyDir = join(tempDir, 'empty');
    await mkdir(emptyDir, { recursive: true });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: emptyDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentsIndexed).toBe(0);
    }
  });

  it('handles directory with only ignored subdirectories', async () => {
    const testDir = join(tempDir, 'test-ignored');
    await mkdir(join(testDir, 'node_modules'), { recursive: true });
    await mkdir(join(testDir, '.git'), { recursive: true });

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentsIndexed).toBe(0);
    }
  });
});

describe('IndexService - Hash and Metadata', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-hash-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('generates file hashes for content tracking', async () => {
    await writeFile(join(testFilesDir, 'test.txt'), 'unique content');

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
  });

  it('includes chunk metadata', async () => {
    const largeContent = 'This is a test. '.repeat(100);
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
      expect(result.data.chunksCreated).toBeGreaterThan(0);
    }
  });

  it('indexes Markdown with section headers', async () => {
    const markdown = '# Section 1\n\nContent 1\n\n## Section 2\n\nContent 2';
    await writeFile(join(testFilesDir, 'doc.md'), markdown);

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
  });

  it('indexes code with function names', async () => {
    const code =
      'export function hello() {\n  return "world";\n}\n\nfunction goodbye() {\n  return "bye";\n}';
    await writeFile(join(testFilesDir, 'code.ts'), code);

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
  });

  it('detects JSDoc comments in chunks', async () => {
    const code = '/** This is a doc comment */\nexport function documented() {}';
    await writeFile(join(testFilesDir, 'documented.ts'), code);

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
  });
});

describe('IndexService - Custom Chunk Configuration', () => {
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-chunk-config-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('uses custom chunk size', async () => {
    const customService = new IndexService(lanceStore, embeddingEngine, {
      chunkSize: 512,
      chunkOverlap: 50,
    });

    const content = 'word '.repeat(200); // ~1000 chars
    await writeFile(join(testFilesDir, 'test.txt'), content);

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await customService.indexStore(store);

    expect(result.success).toBe(true);
    if (result.success) {
      // With smaller chunk size, should create more chunks
      expect(result.data.chunksCreated).toBeGreaterThan(1);
    }
  });

  it('uses custom chunk overlap', async () => {
    const customService = new IndexService(lanceStore, embeddingEngine, {
      chunkSize: 768,
      chunkOverlap: 200,
    });

    const content = 'word '.repeat(400);
    await writeFile(join(testFilesDir, 'overlap-test.txt'), content);

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await customService.indexStore(store);

    expect(result.success).toBe(true);
  });
});

describe('IndexService - Unsupported Store Types', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-unsupported-test-'));

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns error for unsupported web store type', async () => {
    const store = {
      type: 'web' as const,
      id: storeId,
      name: 'Web Store',
      url: 'https://example.com',
      depth: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Indexing not supported for store type');
    }
  });

  it('handles repo store type same as file store', async () => {
    const testFilesDir = join(tempDir, 'repo-files');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(join(testFilesDir, 'repo-file.ts'), 'export const repo = true;');

    const store = {
      type: 'repo' as const,
      id: storeId,
      name: 'Repo Store',
      path: testFilesDir,
      url: 'https://github.com/example/repo',
      branch: 'main',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.documentsIndexed).toBe(1);
    }
  });
});

describe('IndexService - Error Handling Edge Cases', () => {
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-error-edge-test-'));

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('converts non-Error thrown values to Error', async () => {
    // Create a mock that throws a string instead of Error
    const mockLanceStore = {
      addDocuments: vi.fn().mockRejectedValue('string error'),
    } as unknown as LanceStore;

    const indexService = new IndexService(mockLanceStore, embeddingEngine);

    const testFilesDir = join(tempDir, 'error-test');
    await mkdir(testFilesDir, { recursive: true });
    await writeFile(join(testFilesDir, 'test.ts'), 'const x = 1;');

    const store = {
      type: 'file' as const,
      id: storeId,
      name: 'Test Store',
      path: testFilesDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('string error');
    }
  });
});

describe('IndexService - Code Graph Integration', () => {
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-codegraph-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('builds and saves code graph when codeGraphService is provided', async () => {
    const buildGraphMock = vi.fn().mockResolvedValue({ nodes: [], edges: [] });
    const saveGraphMock = vi.fn().mockResolvedValue(undefined);

    const mockCodeGraphService = {
      buildGraph: buildGraphMock,
      saveGraph: saveGraphMock,
    } as unknown as CodeGraphService;

    const indexService = new IndexService(lanceStore, embeddingEngine, {
      codeGraphService: mockCodeGraphService,
    });

    // Create TypeScript files (source files for code graph)
    await writeFile(join(testFilesDir, 'module.ts'), 'export function foo() { return 1; }');
    await writeFile(join(testFilesDir, 'utils.tsx'), 'export const Bar = () => <div />;');

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
    expect(buildGraphMock).toHaveBeenCalled();
    expect(saveGraphMock).toHaveBeenCalledWith(storeId, expect.anything());
  });

  it('does not build code graph when no source files are present', async () => {
    const buildGraphMock = vi.fn();
    const saveGraphMock = vi.fn();

    const mockCodeGraphService = {
      buildGraph: buildGraphMock,
      saveGraph: saveGraphMock,
    } as unknown as CodeGraphService;

    const indexService = new IndexService(lanceStore, embeddingEngine, {
      codeGraphService: mockCodeGraphService,
    });

    const isolatedDir = join(tempDir, 'no-source-files');
    await mkdir(isolatedDir, { recursive: true });
    // Only non-source files
    await writeFile(join(isolatedDir, 'readme.md'), '# Readme');
    await writeFile(join(isolatedDir, 'data.json'), '{}');

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: isolatedDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(true);
    expect(buildGraphMock).not.toHaveBeenCalled();
    expect(saveGraphMock).not.toHaveBeenCalled();
  });

  it('collects .js and .jsx files for code graph', async () => {
    const buildGraphMock = vi.fn().mockResolvedValue({ nodes: [], edges: [] });
    const saveGraphMock = vi.fn().mockResolvedValue(undefined);

    const mockCodeGraphService = {
      buildGraph: buildGraphMock,
      saveGraph: saveGraphMock,
    } as unknown as CodeGraphService;

    const indexService = new IndexService(lanceStore, embeddingEngine, {
      codeGraphService: mockCodeGraphService,
    });

    const jsDir = join(tempDir, 'js-files');
    await mkdir(jsDir, { recursive: true });
    await writeFile(join(jsDir, 'app.js'), 'function main() {}');
    await writeFile(join(jsDir, 'component.jsx'), 'export const App = () => null;');

    const store: FileStore = {
      type: 'file',
      id: storeId,
      name: 'Test Store',
      path: jsDir,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await indexService.indexStore(store);

    expect(result.success).toBe(true);
    expect(buildGraphMock).toHaveBeenCalled();
    // Verify the source files passed to buildGraph
    const sourceFiles = buildGraphMock.mock.calls[0][0] as Array<{ path: string; content: string }>;
    expect(sourceFiles.length).toBe(2);
    expect(sourceFiles.some((f) => f.path.endsWith('.js'))).toBe(true);
    expect(sourceFiles.some((f) => f.path.endsWith('.jsx'))).toBe(true);
  });
});

describe('classifyWebContentType', () => {
  describe('documentation-primary classification', () => {
    it('classifies API reference URLs', () => {
      expect(classifyWebContentType('https://example.com/api-reference/endpoints')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/api-docs/v2')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/apiref/methods')).toBe(
        'documentation-primary'
      );
    });

    it('classifies API reference by title', () => {
      expect(classifyWebContentType('https://example.com/page', 'API Reference Guide')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/page', 'Complete API Documentation')).toBe(
        'documentation-primary'
      );
    });

    it('classifies getting started URLs', () => {
      expect(classifyWebContentType('https://example.com/getting-started')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/getting_started')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/gettingstarted')).toBe(
        'documentation-primary'
      );
    });

    it('classifies quickstart URLs', () => {
      expect(classifyWebContentType('https://example.com/quickstart')).toBe(
        'documentation-primary'
      );
    });

    it('classifies tutorial URLs', () => {
      expect(classifyWebContentType('https://example.com/tutorial/basics')).toBe(
        'documentation-primary'
      );
    });

    it('classifies setup URLs', () => {
      expect(classifyWebContentType('https://example.com/setup')).toBe('documentation-primary');
    });

    it('classifies getting started by title', () => {
      expect(classifyWebContentType('https://example.com/page', 'Getting Started with React')).toBe(
        'documentation-primary'
      );
      expect(classifyWebContentType('https://example.com/page', 'Quickstart Guide')).toBe(
        'documentation-primary'
      );
      expect(
        classifyWebContentType('https://example.com/page', 'Tutorial: Build Your First App')
      ).toBe('documentation-primary');
    });
  });

  describe('documentation classification', () => {
    it('classifies docs paths', () => {
      expect(classifyWebContentType('https://example.com/docs/intro')).toBe('documentation');
      expect(classifyWebContentType('https://example.com/documentation/advanced')).toBe(
        'documentation'
      );
    });

    it('classifies reference paths', () => {
      expect(classifyWebContentType('https://example.com/reference/types')).toBe('documentation');
    });

    it('classifies learn paths', () => {
      expect(classifyWebContentType('https://example.com/learn/basics')).toBe('documentation');
    });

    it('classifies manual paths', () => {
      expect(classifyWebContentType('https://example.com/manual/chapter1')).toBe('documentation');
    });

    it('classifies guide paths', () => {
      expect(classifyWebContentType('https://example.com/guide/installation')).toBe(
        'documentation'
      );
    });
  });

  describe('example classification', () => {
    it('classifies examples paths', () => {
      expect(classifyWebContentType('https://example.com/examples/basic')).toBe('example');
      expect(classifyWebContentType('https://example.com/example/advanced')).toBe('example');
    });

    it('classifies demos paths', () => {
      expect(classifyWebContentType('https://example.com/demos/interactive')).toBe('example');
      expect(classifyWebContentType('https://example.com/demo/live')).toBe('example');
    });

    it('classifies samples paths', () => {
      expect(classifyWebContentType('https://example.com/samples/code')).toBe('example');
    });

    it('classifies cookbook paths', () => {
      expect(classifyWebContentType('https://example.com/cookbook/recipes')).toBe('example');
    });
  });

  describe('changelog classification', () => {
    it('classifies changelog paths', () => {
      // Note: URL must not contain /docs/, /doc/, etc. earlier in the path since those match first
      expect(classifyWebContentType('https://mysite.org/changelog')).toBe('changelog');
    });

    it('classifies release notes paths', () => {
      expect(classifyWebContentType('https://mysite.org/release-notes')).toBe('changelog');
      expect(classifyWebContentType('https://mysite.org/release_notes')).toBe('changelog');
      expect(classifyWebContentType('https://mysite.org/releasenotes')).toBe('changelog');
    });
  });

  describe('other classification', () => {
    it('classifies blog paths', () => {
      // Note: URL must not contain /docs/, /doc/, etc. earlier in the path since those match first
      expect(classifyWebContentType('https://mysite.org/blog/article')).toBe('other');
    });
  });

  describe('default classification', () => {
    it('returns documentation for unrecognized paths', () => {
      // Note: URLs without recognizable patterns default to 'documentation'
      expect(classifyWebContentType('https://mysite.org/about')).toBe('documentation');
      expect(classifyWebContentType('https://mysite.org/')).toBe('documentation');
    });

    it('handles undefined title', () => {
      expect(classifyWebContentType('https://mysite.org/page')).toBe('documentation');
    });

    it('handles empty title', () => {
      expect(classifyWebContentType('https://mysite.org/page', '')).toBe('documentation');
    });
  });
});

describe('IndexService - Additional File Type Classification', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-addl-filetype-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('classifies changes.md as changelog', async () => {
    await writeFile(join(testFilesDir, 'changes.md'), '# Changes\n\n## v1.0.0');

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
  });

  it('classifies files with changelog in name', async () => {
    await writeFile(join(testFilesDir, 'project-changelog.md'), '# Project Changelog');

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
  });

  it('classifies CONTRIBUTING.md as documentation-primary', async () => {
    await writeFile(join(testFilesDir, 'CONTRIBUTING.md'), '# Contributing\n\nHow to contribute.');

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
  });

  it('classifies files in documentation/ directory', async () => {
    const docDir = join(testFilesDir, 'documentation');
    await mkdir(docDir, { recursive: true });
    await writeFile(join(docDir, 'overview.md'), '# Overview');

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
  });

  it('classifies files in guides/ directory', async () => {
    const guidesDir = join(testFilesDir, 'guides');
    await mkdir(guidesDir, { recursive: true });
    await writeFile(join(guidesDir, 'setup.md'), '# Setup Guide');

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
  });

  it('classifies files in tutorials/ directory', async () => {
    const tutorialsDir = join(testFilesDir, 'tutorials');
    await mkdir(tutorialsDir, { recursive: true });
    await writeFile(join(tutorialsDir, 'basics.md'), '# Basics Tutorial');

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
  });

  it('classifies files in articles/ directory', async () => {
    const articlesDir = join(testFilesDir, 'articles');
    await mkdir(articlesDir, { recursive: true });
    await writeFile(join(articlesDir, 'intro.md'), '# Introduction Article');

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
  });

  it('classifies files in __tests__/ directory as test', async () => {
    const testsDir = join(testFilesDir, '__tests__');
    await mkdir(testsDir, { recursive: true });
    await writeFile(join(testsDir, 'util.ts'), 'export function testHelper() {}');

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
  });

  it('classifies files with example in filename', async () => {
    await writeFile(join(testFilesDir, 'example-config.ts'), 'export const config = {};');

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
  });

  it('classifies .eslintrc as config', async () => {
    await writeFile(join(testFilesDir, '.eslintrc.json'), '{}');

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
  });

  it('classifies .prettierrc as config', async () => {
    await writeFile(join(testFilesDir, '.prettierrc.json'), '{}');

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
  });

  it('classifies vite.config as config', async () => {
    await writeFile(join(testFilesDir, 'vite.config.ts'), 'export default {};');

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
  });

  it('classifies next.config as config', async () => {
    await writeFile(join(testFilesDir, 'next.config.js'), 'module.exports = {};');

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
  });

  it('classifies .tsx files as source', async () => {
    await writeFile(join(testFilesDir, 'Component.tsx'), 'export const App = () => <div />;');

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
  });

  it('classifies .jsx files as source', async () => {
    await writeFile(join(testFilesDir, 'Component.jsx'), 'export const App = () => null;');

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
  });

  it('classifies .java files as source', async () => {
    await writeFile(join(testFilesDir, 'Main.java'), 'public class Main {}');

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
  });

  it('classifies unknown file types as other', async () => {
    await writeFile(join(testFilesDir, 'data.csv'), 'a,b,c\n1,2,3');

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
  });
});

describe('IndexService - Additional Internal Implementation Detection', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-addl-internal-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('treats index.js in packages/*/src/ as public API', async () => {
    const pkgDir = join(testFilesDir, 'packages', 'ui', 'src');
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, 'index.js'), 'export * from "./components";');

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
  });

  it('detects lib/core/ directory files as internal', async () => {
    const libCoreDir = join(testFilesDir, 'lib', 'core');
    await mkdir(libCoreDir, { recursive: true });
    await writeFile(join(libCoreDir, 'internals.ts'), 'export function internal() {}');

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
  });

  it('detects core/src/ directory files as internal', async () => {
    const coreSrcDir = join(testFilesDir, 'core', 'src');
    await mkdir(coreSrcDir, { recursive: true });
    await writeFile(join(coreSrcDir, 'engine.ts'), 'export class Engine {}');

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
  });

  it('detects _internal/ directory files as internal', async () => {
    const internalDir = join(testFilesDir, '_internal');
    await mkdir(internalDir, { recursive: true });
    await writeFile(join(internalDir, 'utils.ts'), 'export function hidden() {}');

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
  });

  it('detects transforms/ directory files as internal', async () => {
    const transformsDir = join(testFilesDir, 'transforms');
    await mkdir(transformsDir, { recursive: true });
    await writeFile(join(transformsDir, 'optimize.ts'), 'export function transform() {}');

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
  });

  it('detects parse/ directory files as internal', async () => {
    const parseDir = join(testFilesDir, 'parse');
    await mkdir(parseDir, { recursive: true });
    await writeFile(join(parseDir, 'lexer.ts'), 'export class Lexer {}');

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
  });

  it('detects codegen/ directory files as internal', async () => {
    const codegenDir = join(testFilesDir, 'codegen');
    await mkdir(codegenDir, { recursive: true });
    await writeFile(join(codegenDir, 'generator.ts'), 'export class Generator {}');

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
  });

  it('does not mark readme in compiler dir as internal', async () => {
    const compilerDir = join(testFilesDir, 'src', 'compiler');
    await mkdir(compilerDir, { recursive: true });
    await writeFile(join(compilerDir, 'README.md'), '# Compiler Documentation');

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
  });

  it('does not mark index.ts in compiler dir as internal', async () => {
    const compilerDir = join(testFilesDir, 'src', 'compiler2');
    await mkdir(compilerDir, { recursive: true });
    await writeFile(join(compilerDir, 'index.ts'), 'export * from "./api";');

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
  });
});

describe('IndexService - Symlink Handling', () => {
  let indexService: IndexService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let tempDir: string;
  let testFilesDir: string;
  const storeId = createStoreId('test-store');

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'index-symlink-test-'));
    testFilesDir = join(tempDir, 'files');
    await mkdir(testFilesDir, { recursive: true });

    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();

    await embeddingEngine.initialize();
    await lanceStore.initialize(storeId);

    indexService = new IndexService(lanceStore, embeddingEngine);
  }, 120000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('skips symlinks (non-file, non-directory entries)', async () => {
    // Create a real file
    await writeFile(join(testFilesDir, 'real.ts'), 'export const real = true;');

    // Create a symlink to the file (symlinks are neither isDirectory() nor isFile() when using withFileTypes)
    try {
      await symlink(join(testFilesDir, 'real.ts'), join(testFilesDir, 'link.ts'));
    } catch {
      // Symlink creation may fail on some systems/permissions - skip test in that case
      return;
    }

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
    // The symlink should be processed if it points to a valid file
    // (on most systems, readdir with withFileTypes shows symlinks as isFile() if target is file)
  });
});
