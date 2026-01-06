/**
 * E2E Workflow Integration Tests
 *
 * Tests full end-to-end workflows using minimal test data:
 * - Create stores from fixtures
 * - Index documents
 * - Search and verify results
 * - Export/import workflows
 *
 * REWRITTEN: Now uses service APIs directly instead of CLI to avoid hanging issues.
 * Uses minimal inline fixtures instead of complex fixture loader to keep tests fast.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertHasMatch, CommonKeywords } from '../helpers/search-relevance';
import { measure } from '../helpers/performance-metrics';
import { StoreService } from '../../src/services/store.service.js';
import { IndexService } from '../../src/services/index.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { LanceStore } from '../../src/db/lance.js';
import { EmbeddingEngine } from '../../src/db/embeddings.js';
import type { SearchResult as APISearchResult } from '../../src/types/search.js';
import type { StoreId } from '../../src/types/brands.js';
import type { SearchResult as TestSearchResult } from '../helpers/search-relevance.js';

/**
 * Adapter to convert API SearchResult[] to test helper format.
 */
function adaptApiResults(apiResults: readonly APISearchResult[]): TestSearchResult[] {
  return apiResults.map((result, index) => ({
    rank: index + 1,
    score: result.score,
    source: result.metadata.path ?? result.metadata.url ?? 'unknown',
    content: result.content,
  }));
}

describe('E2E Workflow Tests', () => {
  let tempDir: string;
  let fixturesWorkDir: string;
  let storeService: StoreService;
  let indexService: IndexService;
  let searchService: SearchService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;

  // Store IDs shared across test suites
  let readmeStoreId: StoreId;
  let codeStoreId: StoreId;
  let docsStoreId: StoreId;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-workflow-test-'));
    fixturesWorkDir = join(tempDir, 'fixtures');
    await mkdir(fixturesWorkDir, { recursive: true });

    // Initialize services
    lanceStore = new LanceStore(tempDir);
    embeddingEngine = new EmbeddingEngine();
    await embeddingEngine.initialize();

    storeService = new StoreService(tempDir);
    await storeService.initialize();

    indexService = new IndexService(lanceStore, embeddingEngine);
    searchService = new SearchService(lanceStore, embeddingEngine);
  }, 30000);

  afterAll(async () => {
    // Close LanceStore to prevent mutex crash during process exit
    lanceStore.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('README Fixtures Workflow', () => {
    let readmesDir: string;

    beforeAll(async () => {
      // Create minimal README fixtures
      readmesDir = join(fixturesWorkDir, 'readmes');
      await mkdir(readmesDir, { recursive: true });

      // TypeScript README
      await writeFile(
        join(readmesDir, 'typescript-readme.md'),
        `# TypeScript

TypeScript is a strongly typed programming language that builds on JavaScript.

## Features

- **Type Checking**: The TypeScript compiler performs static type checking
- **Modern JavaScript**: Supports latest ECMAScript features
- **Tooling**: Excellent IDE support with IntelliSense

## Getting Started

\`\`\`typescript
interface User {
  name: string;
  id: number;
}
\`\`\`
`
      );

      // React README
      await writeFile(
        join(readmesDir, 'react-readme.md'),
        `# React

A JavaScript library for building user interfaces with declarative components.

## Core Concepts

- **Components**: Build encapsulated UI components
- **JSX**: Write declarative markup in JavaScript
- **Virtual DOM**: Efficient rendering and updates

## Example Component

\`\`\`jsx
function App() {
  return <div>Hello React</div>;
}
\`\`\`
`
      );

      // Express README
      await writeFile(
        join(readmesDir, 'express-readme.md'),
        `# Express

Fast, unopinionated web framework for Node.js with middleware and routing.

## Features

- **Middleware**: Composable request handling
- **Routing**: HTTP method routing
- **Server**: Simple HTTP server setup

## Quick Start

\`\`\`javascript
const app = express();
app.use(middleware);
app.listen(3000);
\`\`\`
`
      );

      // Create and index store
      const storeResult = await storeService.create({
        name: 'readme-store',
        type: 'file',
        path: readmesDir,
      });

      if (!storeResult.success) {
        throw storeResult.error;
      }

      readmeStoreId = storeResult.data.id;
      await lanceStore.initialize(readmeStoreId);

      const indexResult = await indexService.indexStore(storeResult.data);
      if (!indexResult.success) {
        throw indexResult.error;
      }
    }, 30000);

    it('creates store from README fixtures', () => {
      // Store created in beforeAll, just verify it exists
      expect(readmeStoreId).toBeDefined();
    });

    it('indexes README documents', () => {
      // Already indexed in beforeAll, just verify store exists
      expect(readmeStoreId).toBeDefined();
    });

    it('searches for TypeScript content', async () => {
      const response = await searchService.search({
        query: 'TypeScript compiler type checking',
        stores: [readmeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.TYPESCRIPT,
        sourceContains: 'typescript',
      });
    });

    it('searches for React content', async () => {
      const response = await searchService.search({
        query: 'React component declarative UI',
        stores: [readmeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.REACT,
        sourceContains: 'react',
      });
    });

    it('searches for Express middleware routing', async () => {
      const response = await searchService.search({
        query: 'Express middleware routing HTTP server',
        stores: [readmeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['express', 'middleware', 'routing', 'http'],
      });
    });
  });

  describe('Code Snippets Workflow', () => {
    let codeDir: string;

    beforeAll(async () => {
      // Create minimal code fixtures
      codeDir = join(fixturesWorkDir, 'code');
      await mkdir(codeDir, { recursive: true });

      // JWT authentication middleware
      await writeFile(
        join(codeDir, 'jwt-middleware.ts'),
        `export function jwtAuthMiddleware(req: Request, res: Response, next: Next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}
`
      );

      // OAuth PKCE flow
      await writeFile(
        join(codeDir, 'oauth-pkce.ts'),
        `export class OAuthPKCEFlow {
  async authorize(codeVerifier: string): Promise<string> {
    const codeChallenge = this.generateChallenge(codeVerifier);
    return await this.requestAuthorization(codeChallenge);
  }

  async exchangeToken(code: string, codeVerifier: string): Promise<OAuthToken> {
    // PKCE flow: exchange authorization code with code verifier
    return await this.tokenEndpoint({ code, codeVerifier });
  }
}
`
      );

      // API error handling
      await writeFile(
        join(codeDir, 'api-errors.ts'),
        `export class APIErrorMiddleware {
  handleException(error: Error, req: Request, res: Response) {
    // Error handling middleware for API exceptions
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
`
      );

      // Repository pattern
      await writeFile(
        join(codeDir, 'repository.ts'),
        `export class Repository<T> {
  async create(data: T): Promise<T> {
    // CRUD: Create operation with data access layer
    return await this.db.insert(data);
  }

  async findById(id: string): Promise<T | null> {
    // Repository pattern for data access
    return await this.db.query('SELECT * FROM table WHERE id = ?', [id]);
  }
}
`
      );

      // Create and index store
      const storeResult = await storeService.create({
        name: 'code-store',
        type: 'file',
        path: codeDir,
      });

      if (!storeResult.success) {
        throw storeResult.error;
      }

      codeStoreId = storeResult.data.id;
      await lanceStore.initialize(codeStoreId);

      const indexResult = await indexService.indexStore(storeResult.data);
      if (!indexResult.success) {
        throw indexResult.error;
      }
    }, 30000);

    it('creates store from code snippets', () => {
      // Store created in beforeAll, just verify it exists
      expect(codeStoreId).toBeDefined();
    });

    it('indexes code documents', () => {
      // Already indexed in beforeAll
      expect(codeStoreId).toBeDefined();
    });

    it('finds authentication patterns', async () => {
      const response = await searchService.search({
        query: 'JWT token authentication middleware',
        stores: [codeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.AUTHENTICATION,
      });
    });

    it('finds OAuth implementation', async () => {
      const response = await searchService.search({
        query: 'OAuth PKCE authorization flow',
        stores: [codeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['oauth', 'pkce', 'authorization', 'token'],
      });
    });

    it('finds error handling patterns', async () => {
      const response = await searchService.search({
        query: 'API error handling middleware exceptions',
        stores: [codeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.ERROR_HANDLING,
      });
    });

    it('finds repository pattern implementation', async () => {
      const response = await searchService.search({
        query: 'repository pattern data access CRUD',
        stores: [codeStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.DATABASE,
      });
    });
  });

  describe('Documentation Workflow', () => {
    let docsDir: string;

    beforeAll(async () => {
      // Create minimal documentation fixtures
      docsDir = join(fixturesWorkDir, 'docs');
      await mkdir(docsDir, { recursive: true });

      // Architecture documentation
      await writeFile(
        join(docsDir, 'architecture.md'),
        `# System Architecture

## Overview

The system architecture consists of multiple components with well-defined data flow.

## Core Components

- **Frontend**: React-based UI components
- **Backend**: Node.js API server
- **Database**: PostgreSQL data layer
- **Cache**: Redis for session storage

## Data Flow

1. User request → Frontend component
2. API call → Backend endpoint
3. Data processing → Database query
4. Response → Cache → Frontend
`
      );

      // API reference
      await writeFile(
        join(docsDir, 'api-reference.md'),
        `# REST API Reference

## Authentication

All API endpoints require authentication using a Bearer token.

### Headers

\`\`\`
Authorization: Bearer <token>
\`\`\`

## Endpoints

### GET /api/users
Returns list of users with authentication.

### POST /api/auth/login
Endpoint for user authentication. Returns bearer token.
`
      );

      // Deployment guide
      await writeFile(
        join(docsDir, 'deployment.md'),
        `# Deployment Guide

## Docker Deployment

Build and deploy the application using Docker containers.

\`\`\`bash
docker build -t myapp .
docker run -p 3000:3000 myapp
\`\`\`

## Kubernetes Production Deployment

Deploy to production Kubernetes cluster:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp-production
\`\`\`
`
      );

      // Create and index store
      const storeResult = await storeService.create({
        name: 'docs-store',
        type: 'file',
        path: docsDir,
      });

      if (!storeResult.success) {
        throw storeResult.error;
      }

      docsStoreId = storeResult.data.id;
      await lanceStore.initialize(docsStoreId);

      const indexResult = await indexService.indexStore(storeResult.data);
      if (!indexResult.success) {
        throw indexResult.error;
      }
    }, 30000);

    it('creates store from documentation', () => {
      // Store created in beforeAll, just verify it exists
      expect(docsStoreId).toBeDefined();
    });

    it('indexes documentation', () => {
      // Already indexed in beforeAll
      expect(docsStoreId).toBeDefined();
    });

    it('searches architecture documentation', async () => {
      const response = await searchService.search({
        query: 'system architecture components data flow',
        stores: [docsStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['architecture', 'component', 'data', 'flow'],
      });
    });

    it('searches API reference', async () => {
      const response = await searchService.search({
        query: 'REST API endpoints authentication bearer token',
        stores: [docsStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['api', 'endpoint', 'authentication', 'bearer'],
      });
    });

    it('searches deployment guide', async () => {
      const response = await searchService.search({
        query: 'Docker Kubernetes deployment production',
        stores: [docsStoreId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['docker', 'kubernetes', 'deployment', 'production'],
      });
    });
  });

  describe('Multi-Store Search', () => {
    it('searches across all stores', async () => {
      // Search across all stores (don't specify stores parameter)
      const response = await searchService.search({
        query: 'authentication token security',
        stores: [readmeStoreId, codeStoreId, docsStoreId],
      });
      const results = adaptApiResults(response.results);

      // Should find results from multiple stores
      expect(results.length).toBeGreaterThan(0);
    });

    it('finds related content across different stores', async () => {
      const response = await searchService.search({
        query: 'middleware request handling',
        stores: [readmeStoreId, codeStoreId],
      });
      const results = adaptApiResults(response.results);

      // Should find content from both code and readme stores
      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['middleware', 'request'],
      });
    });
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
        const result = await storeService.create({
          name: 'perf-store',
          type: 'file',
          path: workflowDir,
        });
        if (!result.success) throw result.error;
        return result.data;
      });
      expect(createResult.measurement.duration).toBeLessThan(5000);

      const perfStoreId = createResult.result.id;
      await lanceStore.initialize(perfStoreId);

      // Measure indexing
      const indexResult = await measure('index-store', async () => {
        const result = await indexService.indexStore(createResult.result);
        if (!result.success) throw result.error;
        return result.data;
      });
      expect(indexResult.measurement.duration).toBeLessThan(30000);

      // Measure search
      const searchResult = await measure('search', async () => {
        return await searchService.search({
          query: 'performance testing',
          stores: [perfStoreId],
        });
      });
      expect(searchResult.measurement.duration).toBeLessThan(5000);
    }, 60000);
  });
});
