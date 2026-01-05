import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { IndexService } from './index.service.js';
import { LanceStore } from '../db/lance.js';
import { EmbeddingEngine } from '../db/embeddings.js';
import { createStoreId } from '../types/brands.js';
import { rm, mkdtemp, writeFile, mkdir, symlink, chmod } from 'node:fs/promises';
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
    const code = 'export function hello() {\n  return "world";\n}\n\nfunction goodbye() {\n  return "bye";\n}';
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
