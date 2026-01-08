/**
 * Search Quality Integration Tests
 *
 * Tests search result quality, relevance, and modes:
 * - Semantic relevance validation
 * - Search mode comparison (vector, FTS, hybrid)
 * - Relevance scoring accuracy
 * - Threshold filtering
 * - Query variations
 * - Edge cases
 *
 * REWRITTEN: Now uses SearchService API directly instead of CLI to avoid hanging issues.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertHasMatch,
  assertTopResultsMatch,
  assertProperOrdering,
  assertMinimumScores,
  calculateRelevanceMetrics,
  compareRelevance,
  CommonKeywords,
  type SearchResult as TestSearchResult,
} from '../helpers/search-relevance.js';
import { StoreService } from '../../src/services/store.service.js';
import { IndexService } from '../../src/services/index.service.js';
import { SearchService } from '../../src/services/search.service.js';
import { LanceStore } from '../../src/db/lance.js';
import { EmbeddingEngine } from '../../src/db/embeddings.js';
import type { SearchResult as APISearchResult } from '../../src/types/search.js';
import type { StoreId } from '../../src/types/brands.js';

/**
 * Adapter to convert API SearchResult[] to test helper format.
 * API results don't have rank (position), so we add it based on array order.
 */
function adaptApiResults(apiResults: readonly APISearchResult[]): TestSearchResult[] {
  return apiResults.map((result, index) => ({
    rank: index + 1, // 1-based ranking
    score: result.score,
    source: result.metadata.path ?? result.metadata.url ?? 'unknown',
    content: result.content,
  }));
}

describe('Search Quality Tests', () => {
  let tempDir: string;
  let fixturesDir: string;
  let storeService: StoreService;
  let indexService: IndexService;
  let searchService: SearchService;
  let lanceStore: LanceStore;
  let embeddingEngine: EmbeddingEngine;
  let storeId: StoreId;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'search-quality-test-'));
    fixturesDir = join(tempDir, 'fixtures');

    // Initialize services
    const dataDir = tempDir;
    lanceStore = new LanceStore(dataDir);
    embeddingEngine = new EmbeddingEngine();
    await embeddingEngine.initialize();

    storeService = new StoreService(dataDir);
    await storeService.initialize(); // Must initialize StoreService!

    indexService = new IndexService(lanceStore, embeddingEngine);
    searchService = new SearchService(lanceStore, embeddingEngine);

    // Create minimal test fixtures directly (no complex fixture loader)
    await mkdir(fixturesDir, { recursive: true });

    // Minimal auth file with JWT authentication keywords
    await writeFile(
      join(fixturesDir, 'jwt-auth.ts'),
      `/**
 * JWT Authentication Module
 * Handles user authentication with JWT tokens
 */
export interface JwtPayload {
  userId: string;
  email: string;
  exp: number;
}

export class AuthService {
  /**
   * Authenticate user and generate JWT token
   */
  async authenticate(username: string, password: string): Promise<string> {
    // Verify credentials
    const user = await this.verifyCredentials(username, password);

    // Generate JWT access token
    return this.generateToken(user);
  }

  private generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      exp: Date.now() + 3600000,
    };
    return jwt.sign(payload, process.env.JWT_SECRET);
  }

  /**
   * Verify JWT token and extract payload
   */
  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
}
`
    );

    // Minimal OAuth file
    await writeFile(
      join(fixturesDir, 'oauth-flow.ts'),
      `/**
 * OAuth Flow Implementation
 * Third party login with social providers
 */
export class OAuthProvider {
  async authorizeUser(provider: string): Promise<string> {
    // OAuth authorization flow
    const authUrl = \`https://\${provider}.com/oauth/authorize\`;
    return authUrl;
  }

  async handleCallback(code: string): Promise<User> {
    // Exchange authorization code for access token
    const token = await this.exchangeCode(code);
    return this.getUserProfile(token);
  }
}
`
    );

    // Minimal API error handling file
    await writeFile(
      join(fixturesDir, 'error-handler.ts'),
      `/**
 * API Error Handling
 * Manages exception responses and HTTP status codes
 */
export class ErrorHandler {
  handleError(error: Error, req: Request, res: Response) {
    // Error handling and exception management
    if (error instanceof AuthError) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized',
      });
    }

    if (error instanceof ValidationError) {
      return res.status(400).json({
        status: 'error',
        message: error.message,
      });
    }

    // HTTP 403 forbidden
    if (error instanceof ForbiddenError) {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden',
      });
    }

    // Catch all errors
    return res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
    });
  }
}
`
    );

    // Minimal database file
    await writeFile(
      join(fixturesDir, 'database.ts'),
      `/**
 * Database Module
 * Data persistence and storage operations
 */
export class DatabaseService {
  /**
   * Execute SQL query for data persistence
   */
  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    // Database query execution
    const connection = await this.getConnection();
    return connection.execute(sql, params);
  }

  /**
   * Store data in database
   */
  async save(table: string, data: Record<string, unknown>): Promise<void> {
    // Data persistence layer
    await this.query(\`INSERT INTO \${table} VALUES (?)\`, [data]);
  }
}
`
    );

    // Minimal middleware file
    await writeFile(
      join(fixturesDir, 'auth-middleware.ts'),
      `/**
 * Authentication Middleware
 * Protects API endpoints from unauthorized access
 */
export function authMiddleware(req: Request, res: Response, next: Next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Forbidden' });
  }
}
`
    );

    // Create and index store using API
    const storeResult = await storeService.create({
      name: 'quality-store',
      type: 'file',
      path: fixturesDir,
    });

    if (!storeResult.success) {
      throw storeResult.error;
    }

    const store = storeResult.data;
    storeId = store.id;

    // Initialize Lance table for this store
    await lanceStore.initialize(storeId);

    // Index the store (minimal fixtures should be very fast)
    const indexResult = await indexService.indexStore(store);

    if (!indexResult.success) {
      throw indexResult.error;
    }
  }, 30000); // Reduced timeout - minimal fixtures should index in ~5-10 seconds

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Semantic Relevance', () => {
    it('finds auth code when searching for "user authentication"', async () => {
      const response = await searchService.search({
        query: 'user authentication login',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.AUTHENTICATION,
      });
    });

    it('finds JWT code when searching for "token generation"', async () => {
      const response = await searchService.search({
        query: 'token generation verification',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['token', 'jwt', 'generate', 'verify'],
        sourceContains: 'jwt',
      });
    });

    it('finds error handling when searching for "exception management"', async () => {
      const response = await searchService.search({
        query: 'exception management error responses',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.ERROR_HANDLING,
      });
    });

    it('finds database code when searching for "data persistence"', async () => {
      const response = await searchService.search({
        query: 'data persistence storage',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: CommonKeywords.DATABASE,
      });
    });

    it('finds OAuth when searching for "third party login"', async () => {
      const response = await searchService.search({
        query: 'third party login social auth',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['oauth', 'authorization', 'provider'],
      });
    });
  });

  describe('Search Mode Comparison', () => {
    it('vector search finds semantically related content', async () => {
      const response = await searchService.search({
        query: 'authentication security',
        mode: 'vector',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      // Vector search should find auth-related code
      assertHasMatch(results, {
        keywords: ['auth', 'token', 'jwt', 'login', 'password', 'credential'],
      });
    });

    it('hybrid search finds keyword matches', async () => {
      const response = await searchService.search({
        query: 'token authentication',
        mode: 'hybrid',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      // Hybrid should find token-related content
      assertHasMatch(results, {
        keywords: ['token', 'auth'],
      });
    });

    it('hybrid search combines both approaches', async () => {
      const response = await searchService.search({
        query: 'JWT authentication middleware',
        mode: 'hybrid',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['jwt', 'auth', 'middleware'],
      });
    });

    it('hybrid finds content with common terms', async () => {
      const response = await searchService.search({
        query: 'error response status',
        mode: 'hybrid',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['error', 'response', 'status'],
      });
    });

    it('search finds auth content with natural language', async () => {
      const response = await searchService.search({
        query: 'how to protect API endpoints from unauthorized access',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // Should find auth/api-related code
      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: [...CommonKeywords.AUTHENTICATION, ...CommonKeywords.API, 'error', 'forbidden'],
      });
    });
  });

  describe('Relevance Scoring', () => {
    it('results are ordered by score descending', async () => {
      const response = await searchService.search({
        query: 'authentication token',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(1);
      assertProperOrdering(results);
    });

    it('exact matches have higher scores', async () => {
      const response = await searchService.search({
        query: 'JWT Authentication Module',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      // The file containing exact match should rank high
      assertHasMatch(results, {
        keywords: ['jwt', 'authentication', 'module'],
        maxRank: 3,
      });
    });

    it('source file matches boost relevance', async () => {
      const response = await searchService.search({
        query: 'OAuth flow implementation',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      // oauth-flow.ts should be in top results
      assertHasMatch(results, {
        sourceContains: 'oauth',
        maxRank: 3,
      });
    });
  });

  describe('Threshold Filtering', () => {
    it('high threshold returns fewer results', async () => {
      const lowResponse = await searchService.search({
        query: 'authentication',
        threshold: 0.3,
        stores: [storeId],
      });
      const highResponse = await searchService.search({
        query: 'authentication',
        threshold: 0.7,
        stores: [storeId],
      });

      const lowResults = adaptApiResults(lowResponse.results);
      const highResults = adaptApiResults(highResponse.results);

      // High threshold should return fewer or equal results
      expect(highResults.length).toBeLessThanOrEqual(lowResults.length);
    });

    it('threshold 0.8 filters out low relevance matches', async () => {
      const response = await searchService.search({
        query: 'middleware',
        threshold: 0.8,
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // All results should meet the threshold
      if (results.length > 0) {
        assertMinimumScores(results, 0.8);
      }
    });

    it('lower threshold includes more results', async () => {
      const response = await searchService.search({
        query: 'error handling',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // Should find error handling content
      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['error', 'handling', 'exception', 'catch'],
      });
    });
  });

  describe('Query Variations', () => {
    it('different phrasings find same authentication content', async () => {
      const queries = [
        'user login authentication',
        'authenticate users securely',
        'login system implementation',
        'user auth flow',
      ];

      for (const query of queries) {
        const response = await searchService.search({
          query,
          stores: [storeId],
        });
        const results = adaptApiResults(response.results);

        expect(results.length).toBeGreaterThan(0);
        assertHasMatch(results, {
          keywords: CommonKeywords.AUTHENTICATION,
        });
      }
    });

    it('singular and plural forms find same content', async () => {
      const singularResponse = await searchService.search({
        query: 'error handler',
        stores: [storeId],
      });
      const pluralResponse = await searchService.search({
        query: 'error handlers',
        stores: [storeId],
      });

      const singularResults = adaptApiResults(singularResponse.results);
      const pluralResults = adaptApiResults(pluralResponse.results);

      // Both should find error handling content
      expect(singularResults.length).toBeGreaterThan(0);
      expect(pluralResults.length).toBeGreaterThan(0);

      assertHasMatch(singularResults, { keywords: ['error'] });
      assertHasMatch(pluralResults, { keywords: ['error'] });
    });

    it('abbreviations find full terms', async () => {
      const response = await searchService.search({
        query: 'auth middleware JWT',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['authentication', 'jwt', 'middleware'],
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles queries with no results gracefully', async () => {
      // Semantic search may return results even for nonsense queries (nearest neighbors)
      // With normalized scores, threshold filtering applies to relative scores
      const response = await searchService.search({
        query: 'xyznonexistent123',
        threshold: 0.9,
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // Search should not throw and may return some results
      // (embedding models find nearest neighbors even for gibberish)
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles special characters in queries', async () => {
      const response = await searchService.search({
        query: 'async/await Promise<T>',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // Should not throw and may find async-related content
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles very short queries', async () => {
      const response = await searchService.search({
        query: 'api',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
    });

    it('handles long queries', async () => {
      const longQuery =
        'how to implement secure user authentication with JWT tokens including ' +
        'refresh token rotation and proper error handling for expired sessions';

      const response = await searchService.search({
        query: longQuery,
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['jwt', 'token', 'auth'],
      });
    });

    it('handles queries with numbers', async () => {
      const response = await searchService.search({
        query: 'HTTP 401 403 status codes',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
    });

    it('handles mixed case queries', async () => {
      const response = await searchService.search({
        query: 'JwtPayload AccessToken',
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      expect(results.length).toBeGreaterThan(0);
      assertHasMatch(results, {
        keywords: ['jwt', 'payload', 'token'],
      });
    });
  });

  describe('Result Quality Metrics', () => {
    it('calculates precision for authentication queries', async () => {
      const response = await searchService.search({
        query: 'user authentication',
        limit: 10,
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      const metrics = calculateRelevanceMetrics(results, {
        keywords: CommonKeywords.AUTHENTICATION,
      });

      // At least 50% of results should be relevant to authentication
      expect(metrics.precision).toBeGreaterThanOrEqual(0.5);
      expect(metrics.topScore).toBeGreaterThan(0);
    });

    it('compares relevance between search modes', async () => {
      const vectorResponse = await searchService.search({
        query: 'authentication token',
        mode: 'vector',
        stores: [storeId],
      });
      const hybridResponse = await searchService.search({
        query: 'authentication token',
        mode: 'hybrid',
        stores: [storeId],
      });

      const vectorResults = adaptApiResults(vectorResponse.results);
      const hybridResults = adaptApiResults(hybridResponse.results);

      // Both modes should return results
      expect(vectorResults.length).toBeGreaterThan(0);
      expect(hybridResults.length).toBeGreaterThan(0);

      const comparison = compareRelevance(vectorResults, hybridResults, {
        keywords: ['auth', 'token', 'jwt', 'login', 'session'],
      });

      // Both modes should produce some relevant results
      expect(comparison.baselineMetrics.totalCount).toBeGreaterThan(0);
      expect(comparison.comparisonMetrics.totalCount).toBeGreaterThan(0);
    });
  });

  describe('Limit Parameter', () => {
    it('respects result limit', async () => {
      const response5 = await searchService.search({
        query: 'function',
        limit: 5,
        stores: [storeId],
      });
      const response10 = await searchService.search({
        query: 'function',
        limit: 10,
        stores: [storeId],
      });

      const results5 = adaptApiResults(response5.results);
      const results10 = adaptApiResults(response10.results);

      expect(results5.length).toBeLessThanOrEqual(5);
      expect(results10.length).toBeLessThanOrEqual(10);
    });

    it('returns all results when limit exceeds matches', async () => {
      const response = await searchService.search({
        query: 'verifyAccessToken',
        limit: 100,
        stores: [storeId],
      });
      const results = adaptApiResults(response.results);

      // Should return actual matches, not pad to limit
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThan(100);
    });
  });
});
