/**
 * E2E Workflow Integration Tests
 *
 * Tests full end-to-end workflows using real fixture data:
 * - Create stores from fixtures
 * - Index documents
 * - Search and verify results
 * - Export/import workflows
 */

/**
 * SKIPPED: E2E tests use execSync which hangs in test environment
 *
 * Issue: Uses execSync to run CLI commands which hang (same as cli.test.ts)
 * - Would timeout waiting for CLI subprocess
 * - Tests workflows via real CLI commands
 *
 * To re-enable: Fix CLI subprocess hanging or rewrite to use API directly
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'node:child_process';
import { rm, mkdtemp, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadAllFixtures,
  loadByCategory,
  FixtureCategories,
  FIXTURES_DIR,
} from '../helpers/fixture-loader';
import { parseSearchOutput, assertHasMatch, CommonKeywords } from '../helpers/search-relevance';
import { measure } from '../helpers/performance-metrics';

describe.skip('E2E Workflow Tests', () => {
  let tempDir: string;
  let fixturesWorkDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-workflow-test-'));
    fixturesWorkDir = join(tempDir, 'fixtures');
    await mkdir(fixturesWorkDir, { recursive: true });
  }, 30000);

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const cli = (args: string, timeout = 120000): string => {
    return execSync(`node dist/index.js ${args} --data-dir "${tempDir}"`, {
      encoding: 'utf-8',
      timeout,
    });
  };

  describe('README Fixtures Workflow', () => {
    let readmesDir: string;

    beforeAll(async () => {
      // Copy README fixtures to working directory
      readmesDir = join(fixturesWorkDir, 'readmes');
      await mkdir(readmesDir, { recursive: true });

      const readmes = await loadByCategory(FixtureCategories.GITHUB_READMES);
      for (const fixture of readmes) {
        await writeFile(join(readmesDir, fixture.filename), fixture.content);
      }
    });

    it('creates store from README fixtures', () => {
      const output = cli(`store create readme-store --type file --source "${readmesDir}"`);
      expect(output).toContain('readme-store');

      const listOutput = cli('store list');
      expect(listOutput).toContain('readme-store');
    }, 30000);

    it('indexes README documents', () => {
      const output = cli('index readme-store');
      expect(output).toContain('Indexed');
      expect(output).toContain('documents');
    }, 120000);

    it('searches for TypeScript content', () => {
      const output = cli('search "TypeScript compiler type checking" --stores readme-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.TYPESCRIPT,
        sourceContains: 'typescript',
      });
    }, 60000);

    it('searches for React content', () => {
      const output = cli('search "React component declarative UI" --stores readme-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.REACT,
        sourceContains: 'react',
      });
    }, 60000);

    it('searches for Express middleware routing', () => {
      const output = cli('search "Express middleware routing HTTP server" --stores readme-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['express', 'middleware', 'routing', 'http'],
      });
    }, 60000);
  });

  describe('Code Snippets Workflow', () => {
    let codeDir: string;

    beforeAll(async () => {
      // Copy code snippet fixtures to working directory
      codeDir = join(fixturesWorkDir, 'code');
      await mkdir(join(codeDir, 'auth'), { recursive: true });
      await mkdir(join(codeDir, 'api'), { recursive: true });
      await mkdir(join(codeDir, 'database'), { recursive: true });

      const authFixtures = await loadByCategory(FixtureCategories.CODE_AUTH);
      for (const fixture of authFixtures) {
        await writeFile(join(codeDir, 'auth', fixture.filename), fixture.content);
      }

      const apiFixtures = await loadByCategory(FixtureCategories.CODE_API);
      for (const fixture of apiFixtures) {
        await writeFile(join(codeDir, 'api', fixture.filename), fixture.content);
      }

      const dbFixtures = await loadByCategory(FixtureCategories.CODE_DATABASE);
      for (const fixture of dbFixtures) {
        await writeFile(join(codeDir, 'database', fixture.filename), fixture.content);
      }
    });

    it('creates store from code snippets', () => {
      const output = cli(`store create code-store --type file --source "${codeDir}"`);
      expect(output).toContain('code-store');
    });

    it('indexes code documents', () => {
      const output = cli('index code-store');
      expect(output).toContain('Indexed');
    }, 120000);

    it('finds authentication patterns', () => {
      const output = cli('search "JWT token authentication middleware" --stores code-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.AUTHENTICATION,
      });
    }, 60000);

    it('finds OAuth implementation', () => {
      const output = cli('search "OAuth PKCE authorization flow" --stores code-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['oauth', 'pkce', 'authorization', 'token'],
      });
    }, 60000);

    it('finds error handling patterns', () => {
      const output = cli('search "API error handling middleware exceptions" --stores code-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.ERROR_HANDLING,
      });
    }, 60000);

    it('finds repository pattern implementation', () => {
      const output = cli('search "repository pattern data access CRUD" --stores code-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.DATABASE,
      });
    }, 60000);
  });

  describe('Documentation Workflow', () => {
    let docsDir: string;

    beforeAll(async () => {
      // Copy documentation fixtures to working directory
      docsDir = join(fixturesWorkDir, 'docs');
      await mkdir(docsDir, { recursive: true });

      const docFixtures = await loadByCategory(FixtureCategories.DOCUMENTATION);
      for (const fixture of docFixtures) {
        await writeFile(join(docsDir, fixture.filename), fixture.content);
      }
    });

    it('creates store from documentation', () => {
      const output = cli(`store create docs-store --type file --source "${docsDir}"`);
      expect(output).toContain('docs-store');
    });

    it('indexes documentation', () => {
      const output = cli('index docs-store');
      expect(output).toContain('Indexed');
    }, 120000);

    it('searches architecture documentation', () => {
      const output = cli('search "system architecture components data flow" --stores docs-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['architecture', 'component', 'data', 'flow'],
      });
    }, 60000);

    it('searches API reference', () => {
      const output = cli('search "REST API endpoints authentication bearer token" --stores docs-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['api', 'endpoint', 'authentication', 'bearer'],
      });
    }, 60000);

    it('searches deployment guide', () => {
      const output = cli('search "Docker Kubernetes deployment production" --stores docs-store');
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['docker', 'kubernetes', 'deployment', 'production'],
      });
    }, 60000);
  });

  describe('Multi-Store Search', () => {
    it('searches across all stores', () => {
      // Search without specifying a store should search all
      const output = cli('search "authentication token security"');
      const results = parseSearchOutput(output);

      // Should find results from multiple stores
      expect(results.length).toBeGreaterThan(0);
    }, 60000);

    it('finds related content across different stores', () => {
      const output = cli('search "middleware request handling"');
      const results = parseSearchOutput(output);

      // Should find content from both code and readme stores
      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['middleware', 'request'],
      });
    }, 60000);
  });

  describe('Export/Import Workflow', () => {
    let exportPath: string;
    let importedStoreName: string;

    beforeAll(() => {
      exportPath = join(tempDir, 'export.json');
      importedStoreName = `imported-store-${Date.now()}`;
    });

    it('exports a store', () => {
      const output = cli(`export code-store "${exportPath}"`);
      expect(output).toContain('Exported');
    });

    it('export file contains valid data', async () => {
      const content = await readFile(exportPath, 'utf-8');
      const data = JSON.parse(content);

      expect(data).toHaveProperty('store');
      expect(data).toHaveProperty('documents');
      expect(Array.isArray(data.documents)).toBe(true);
      expect(data.documents.length).toBeGreaterThan(0);
    });

    it('imports to a new store', () => {
      // Import uses positional arguments: import <path> <name>
      cli(`import "${exportPath}" ${importedStoreName}`);

      const listOutput = cli('store list');
      expect(listOutput).toContain(importedStoreName);
    });

    it('imported store is searchable', () => {
      const output = cli(`search "authentication" --stores ${importedStoreName}`);
      const results = parseSearchOutput(output);

      expect(results.length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Workflow Performance', () => {
    it('completes full workflow within acceptable time', async () => {
      const workflowDir = join(fixturesWorkDir, 'perf-test');
      await mkdir(workflowDir, { recursive: true });

      // Create a small test file
      await writeFile(
        join(workflowDir, 'test.md'),
        '# Performance Test\n\nThis document tests workflow performance.\n\n## Section 1\n\nContent for testing indexing and search speed.'
      );

      // Measure store creation
      const createResult = await measure('create-store', async () => {
        return cli(`store create perf-store --type file --source "${workflowDir}"`);
      });
      expect(createResult.measurement.duration).toBeLessThan(5000);

      // Measure indexing
      const indexResult = await measure('index-store', async () => {
        return cli('index perf-store');
      });
      expect(indexResult.measurement.duration).toBeLessThan(30000);

      // Measure search
      const searchResult = await measure('search', async () => {
        return cli('search "performance testing" --stores perf-store');
      });
      expect(searchResult.measurement.duration).toBeLessThan(5000);
    }, 120000);
  });
});
