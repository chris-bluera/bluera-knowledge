import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { SearchQuery, SearchResponse, SearchResult } from '../types/search.js';
import type { StoreId } from '../types/brands.js';
import { extractSnippet } from './snippet.service.js';

// Known frameworks/technologies for context-aware boosting
const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /\bexpress\b/i, terms: ['express', 'expressjs', 'express.js'] },
  { pattern: /\bhono\b/i, terms: ['hono'] },
  { pattern: /\bzod\b/i, terms: ['zod'] },
  { pattern: /\breact\b/i, terms: ['react', 'reactjs', 'react.js'] },
  { pattern: /\bnode\b/i, terms: ['node', 'nodejs', 'node.js'] },
  { pattern: /\btypescript\b/i, terms: ['typescript', 'ts'] },
];

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
    // Lower k value (20 vs 60) produces more differentiated scores for top results
    rrfConfig: RRFConfig = { k: 20, vectorWeight: 0.6, ftsWeight: 0.4 }
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

    // Fetch more results than needed to allow for deduplication
    const fetchLimit = limit * 3;

    if (mode === 'vector') {
      allResults = await this.vectorSearch(query.query, stores, fetchLimit, query.threshold);
    } else if (mode === 'fts') {
      allResults = await this.ftsSearch(query.query, stores, fetchLimit);
    } else {
      // Hybrid: combine vector and FTS with RRF
      allResults = await this.hybridSearch(query.query, stores, fetchLimit, query.threshold);
    }

    // Deduplicate by source file - keep highest-scoring chunk per source
    const dedupedResults = this.deduplicateBySource(allResults);

    // Generate query-aware snippets for each result
    const resultsWithSnippets = dedupedResults.slice(0, limit).map(r => ({
      ...r,
      highlight: extractSnippet(r.content, query.query, { maxLength: 200 }),
    }));

    return {
      query: query.query,
      mode,
      stores,
      results: resultsWithSnippets,
      totalResults: resultsWithSnippets.length,
      timeMs: Date.now() - startTime,
    };
  }

  /**
   * Deduplicate results by source file path.
   * Keeps the highest-scoring chunk for each unique source.
   */
  private deduplicateBySource(results: SearchResult[]): SearchResult[] {
    const bySource = new Map<string, SearchResult>();

    for (const result of results) {
      // Use file path as the source key, fallback to document ID
      const sourceKey = result.metadata.path ?? result.metadata.url ?? result.id;

      const existing = bySource.get(sourceKey);
      if (!existing || result.score > existing.score) {
        bySource.set(sourceKey, result);
      }
    }

    // Return results sorted by score
    return Array.from(bySource.values()).sort((a, b) => b.score - a.score);
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

    // Calculate RRF scores with file-type boosting
    const rrfScores: Array<{ id: string; score: number; result: SearchResult }> = [];
    const { k, vectorWeight, ftsWeight } = this.rrfConfig;

    for (const [id, result] of allDocs) {
      const vectorRank = vectorRanks.get(id) ?? Infinity;
      const ftsRank = ftsRanks.get(id) ?? Infinity;

      const vectorRRF = vectorRank !== Infinity ? vectorWeight / (k + vectorRank) : 0;
      const ftsRRF = ftsRank !== Infinity ? ftsWeight / (k + ftsRank) : 0;

      // Apply file-type boost
      const fileTypeBoost = this.getFileTypeBoost(result.metadata.fileType as string | undefined);

      // Apply framework context boost
      const frameworkBoost = this.getFrameworkContextBoost(query, result);

      rrfScores.push({
        id,
        score: (vectorRRF + ftsRRF) * fileTypeBoost * frameworkBoost,
        result,
      });
    }

    // Sort by RRF score
    const sorted = rrfScores.sort((a, b) => b.score - a.score).slice(0, limit);

    // Normalize scores to 0-1 range for better interpretability
    if (sorted.length > 0) {
      const maxScore = sorted[0]!.score;
      const minScore = sorted[sorted.length - 1]!.score;
      const range = maxScore - minScore;

      if (range > 0) {
        return sorted.map(r => ({
          ...r.result,
          score: (r.score - minScore) / range, // Normalized to 0-1
        }));
      }
    }

    return sorted.map(r => ({ ...r.result, score: r.score }));
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

  /**
   * Get a score multiplier based on file type.
   * Documentation files get a boost to surface them higher.
   */
  private getFileTypeBoost(fileType: string | undefined): number {
    switch (fileType) {
      case 'documentation-primary':
        return 1.3;  // README, CHANGELOG get strong boost
      case 'documentation':
        return 1.2;  // Other docs get moderate boost
      case 'example':
        return 1.15; // Examples are valuable
      case 'test':
        return 0.95; // Tests slightly lower
      case 'source':
        return 1.0;  // Source code baseline
      case 'config':
        return 0.9;  // Config files usually less relevant
      default:
        return 1.0;
    }
  }

  /**
   * Get a score multiplier based on framework context.
   * If query mentions a framework, boost results from that framework's files.
   */
  private getFrameworkContextBoost(query: string, result: SearchResult): number {
    const path = result.metadata.path ?? result.metadata.url ?? '';
    const content = result.content.toLowerCase();
    const pathLower = path.toLowerCase();

    // Check if query mentions any known frameworks
    for (const { pattern, terms } of FRAMEWORK_PATTERNS) {
      if (pattern.test(query)) {
        // Query mentions this framework - check if result is from that framework
        const resultMatchesFramework = terms.some(term =>
          pathLower.includes(term) || content.includes(term)
        );

        if (resultMatchesFramework) {
          return 1.4; // Strong boost for matching framework
        } else {
          return 0.7; // Penalty for non-matching when framework is specified
        }
      }
    }

    return 1.0; // No framework context in query
  }
}
