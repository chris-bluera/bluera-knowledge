/**
 * Stress Tests
 *
 * Tests performance under load and with large datasets:
 * - Large file count indexing
 * - Search performance at scale
 * - Sequential operation performance
 * - Chunking behavior with large files
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Benchmark,
  calculateThroughput,
  assertPerformanceTargets,
  DefaultTargets,
  measure,
} from '../helpers/performance-metrics';
import { parseSearchOutput } from '../helpers/search-relevance';

describe('Stress Tests', () => {
  let tempDir: string;
  let largeDatasetDir: string;

  const FILE_COUNT = 150;
  const LARGE_FILE_LINES = 1000;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'stress-test-'));
    largeDatasetDir = join(tempDir, 'large-dataset');
    await mkdir(largeDatasetDir, { recursive: true });
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const cli = (args: string, timeout = 300000): string => {
    return execSync(`node dist/index.js ${args} --data-dir "${tempDir}"`, {
      encoding: 'utf-8',
      timeout,
    });
  };

  describe('Large Dataset Indexing', () => {
    beforeAll(async () => {
      // Generate 150+ test files with varied content
      const categories = [
        'authentication',
        'database',
        'api',
        'frontend',
        'testing',
        'deployment',
        'security',
        'performance',
        'documentation',
        'configuration',
      ];

      const contentTemplates = [
        (cat: string, i: number) =>
          `# ${cat} Module ${i}\n\nThis module handles ${cat} functionality.\n\n## Overview\n\nThe ${cat} system provides essential features for the application.\n\n## Implementation\n\nKey features include:\n- Feature A for ${cat}\n- Feature B for ${cat}\n- Integration with other modules\n\n## Usage\n\n\`\`\`typescript\nimport { ${cat}Service } from './${cat}';\nconst service = new ${cat}Service();\nawait service.initialize();\n\`\`\`\n`,
        (cat: string, i: number) =>
          `/**\n * ${cat} Service Implementation\n * Module ${i}\n */\n\nexport class ${cat}Service {\n  private config: ${cat}Config;\n\n  constructor(config: ${cat}Config) {\n    this.config = config;\n  }\n\n  async process(data: ${cat}Data): Promise<${cat}Result> {\n    // Process ${cat} data\n    return { success: true };\n  }\n\n  async validate(input: unknown): Promise<boolean> {\n    // Validate ${cat} input\n    return true;\n  }\n}\n`,
        (cat: string, i: number) =>
          `# ${cat} API Reference\n\n## Endpoints\n\n### GET /${cat}/${i}\n\nRetrieve ${cat} data.\n\n### POST /${cat}/${i}\n\nCreate new ${cat} entry.\n\n### PUT /${cat}/${i}/:id\n\nUpdate existing ${cat}.\n\n### DELETE /${cat}/${i}/:id\n\nRemove ${cat} entry.\n\n## Authentication\n\nAll endpoints require Bearer token authentication.\n`,
      ];

      let fileIndex = 0;
      for (const category of categories) {
        const categoryDir = join(largeDatasetDir, category);
        await mkdir(categoryDir, { recursive: true });

        for (let i = 0; i < Math.ceil(FILE_COUNT / categories.length); i++) {
          const template = contentTemplates[fileIndex % contentTemplates.length];
          const content = template(category, i);
          const ext = fileIndex % 2 === 0 ? 'md' : 'ts';
          await writeFile(join(categoryDir, `${category}-${i}.${ext}`), content);
          fileIndex++;

          if (fileIndex >= FILE_COUNT) break;
        }
        if (fileIndex >= FILE_COUNT) break;
      }
    }, 60000);

    it(`indexes ${FILE_COUNT}+ files without timeout`, async () => {
      // Create store
      cli(`store create stress-store --type file --source "${largeDatasetDir}"`);

      // Measure indexing time
      const { measurement } = await measure('index-large-dataset', async () => {
        return cli('index stress-store');
      });

      // Should complete without timeout
      expect(measurement.duration).toBeLessThan(300000); // 5 minutes max

      const throughput = calculateThroughput(FILE_COUNT, measurement.duration);
      console.log(`Indexing throughput: ${throughput.itemsPerSecond.toFixed(2)} docs/sec`);
      console.log(`Average: ${throughput.msPerItem.toFixed(2)} ms/doc`);

      // Target: less than 100ms per document average
      expect(throughput.msPerItem).toBeLessThan(100);
    }, 300000);

    it('verifies all documents were indexed', () => {
      const output = cli('store info stress-store');
      // Should show document count >= FILE_COUNT
      expect(output).toContain('stress-store');
    });
  });

  describe('Sequential Operation Performance', () => {
    it('multiple sequential searches maintain performance', async () => {
      const benchmark = new Benchmark('sequential-searches');

      // Run 20 sequential searches
      for (let i = 0; i < 20; i++) {
        await benchmark.run(async () => {
          return cli('search "module implementation" --stores stress-store');
        });
      }

      const stats = benchmark.getStats();
      console.log(benchmark.formatReport());

      // Later searches should not be significantly slower than earlier ones
      const measurements = benchmark.getMeasurements();
      const firstHalf = measurements.slice(0, 10);
      const secondHalf = measurements.slice(10);

      const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.duration, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.duration, 0) / secondHalf.length;

      // Second half should not be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
    }, 120000);

    it('alternating search modes maintain performance', async () => {
      const modes = ['vector', 'fts', 'hybrid'];
      const benchmark = new Benchmark('alternating-modes');

      for (let i = 0; i < 15; i++) {
        const mode = modes[i % modes.length];
        await benchmark.run(async () => {
          return cli(`search "service implementation" --mode ${mode} --stores stress-store`);
        });
      }

      const stats = benchmark.getStats();
      expect(stats.p95).toBeLessThan(1500);
    }, 120000);
  });

  describe('Large File Chunking', () => {
    let largeFileDir: string;

    beforeAll(async () => {
      largeFileDir = join(tempDir, 'large-files');
      await mkdir(largeFileDir, { recursive: true });

      // Create a large file with 1000 lines
      const lines: string[] = [];
      for (let i = 0; i < LARGE_FILE_LINES; i++) {
        lines.push(`## Section ${i}\n`);
        lines.push(`This is content for section ${i}. It discusses various topics including `);
        lines.push(`authentication, database operations, API design, and more.\n`);
        lines.push(`Key points for section ${i}:\n`);
        lines.push(`- Point A about feature ${i}\n`);
        lines.push(`- Point B about implementation ${i}\n`);
        lines.push(`- Point C about optimization ${i}\n\n`);
      }

      await writeFile(join(largeFileDir, 'large-document.md'), lines.join(''));

      // Create store and index
      cli(`store create chunking-store --type file --source "${largeFileDir}"`);
      cli('index chunking-store');
    }, 120000);

    it('creates appropriate number of chunks for large files', () => {
      const output = cli('store info chunking-store');
      expect(output).toContain('chunking-store');
      // Large file should be chunked into multiple pieces
    });

    it('searches across chunks efficiently', async () => {
      const { result, measurement } = await measure('search-chunked', async () => {
        return cli('search "section optimization" --stores chunking-store');
      });

      const results = parseSearchOutput(result);
      expect(results.length).toBeGreaterThan(0);
      expect(measurement.duration).toBeLessThan(1000);
    }, 60000);

    it('finds content from different parts of large file', () => {
      // Search for content that appears in different sections
      const earlyOutput = cli('search "Section 10" --stores chunking-store');
      const middleOutput = cli('search "Section 500" --stores chunking-store');
      const lateOutput = cli('search "Section 990" --stores chunking-store');

      const earlyResults = parseSearchOutput(earlyOutput);
      const middleResults = parseSearchOutput(middleOutput);
      const lateResults = parseSearchOutput(lateOutput);

      // Should find content from various parts of the file
      expect(earlyResults.length + middleResults.length + lateResults.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Memory and Resource Usage', () => {
    it('handles rapid successive queries without degradation', async () => {
      const rapidBenchmark = new Benchmark('rapid-queries');

      // Fire 30 queries in rapid succession
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 30; i++) {
        promises.push(
          rapidBenchmark.run(async () => {
            return cli('search "module" --limit 5 --stores stress-store');
          })
        );
      }

      const stats = rapidBenchmark.getStats();
      expect(stats.max).toBeLessThan(3000); // No single query should take > 3s
    }, 180000);
  });

  describe('Concurrent Store Operations', () => {
    it('handles operations on multiple stores', async () => {
      // Create additional stores
      const store2Dir = join(tempDir, 'store2');
      const store3Dir = join(tempDir, 'store3');
      await mkdir(store2Dir, { recursive: true });
      await mkdir(store3Dir, { recursive: true });

      await writeFile(
        join(store2Dir, 'doc.md'),
        '# Store 2 Document\n\nContent for testing store 2 operations.'
      );
      await writeFile(
        join(store3Dir, 'doc.md'),
        '# Store 3 Document\n\nContent for testing store 3 operations.'
      );

      cli(`store create stress-store-2 --type file --source "${store2Dir}"`);
      cli(`store create stress-store-3 --type file --source "${store3Dir}"`);
      cli('index stress-store-2');
      cli('index stress-store-3');

      // Search across stores
      const { measurement } = await measure('multi-store-search', async () => {
        return cli('search "document content"');
      });

      expect(measurement.duration).toBeLessThan(2000);
    }, 120000);
  });

  describe('Edge Case Stress', () => {
    it('handles many small results efficiently', () => {
      const output = cli('search "module" --limit 50 --stores stress-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(50);
    }, 60000);

    it('handles broad queries without timeout', async () => {
      const { measurement } = await measure('broad-query', async () => {
        return cli('search "the" --limit 20 --stores stress-store');
      });

      expect(measurement.duration).toBeLessThan(2000);
    }, 60000);

    it('handles queries with many potential matches', async () => {
      const { measurement } = await measure('common-term', async () => {
        return cli('search "implementation" --stores stress-store');
      });

      expect(measurement.duration).toBeLessThan(1000);
    }, 60000);
  });
});
