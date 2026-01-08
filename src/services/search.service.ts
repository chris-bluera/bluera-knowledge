import { CodeUnitService } from './code-unit.service.js';
import { createLogger } from '../logging/index.js';
import type { CodeGraphService } from './code-graph.service.js';
import type { CodeGraph } from '../analysis/code-graph.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { LanceStore } from '../db/lance.js';
import type { StoreId } from '../types/brands.js';
import type {
  SearchQuery,
  SearchResponse,
  SearchResult,
  SearchConfidence,
  DetailLevel,
  CodeUnit,
} from '../types/search.js';

const logger = createLogger('search-service');

/**
 * Query intent classification for context-aware ranking.
 * Different intents prioritize different content types.
 */
export type QueryIntent = 'how-to' | 'implementation' | 'conceptual' | 'comparison' | 'debugging';

/**
 * Classified intent with confidence score for multi-intent queries.
 */
export interface ClassifiedIntent {
  intent: QueryIntent;
  confidence: number;
}

/**
 * Intent-based file type multipliers - CONSERVATIVE version.
 * Applied on top of base file-type boosts.
 * Lessons learned: Too-aggressive penalties hurt when corpus lacks ideal content.
 * These values provide gentle guidance rather than dramatic reranking.
 */
const INTENT_FILE_BOOSTS: Record<QueryIntent, Record<string, number>> = {
  'how-to': {
    'documentation-primary': 1.3, // Strong boost for docs
    documentation: 1.2,
    example: 1.5, // Examples are ideal for "how to"
    source: 0.85, // Moderate penalty - source might still have good content
    'source-internal': 0.7, // Stronger penalty - internal code less useful
    test: 0.8,
    config: 0.7,
    other: 0.9,
  },
  implementation: {
    'documentation-primary': 0.95,
    documentation: 1.0,
    example: 1.0,
    source: 1.1, // Slight boost for source code
    'source-internal': 1.05, // Internal code can be relevant
    test: 1.0,
    config: 0.95,
    other: 1.0,
  },
  conceptual: {
    'documentation-primary': 1.1,
    documentation: 1.05,
    example: 1.0,
    source: 0.95,
    'source-internal': 0.9,
    test: 0.9,
    config: 0.85,
    other: 0.95,
  },
  comparison: {
    'documentation-primary': 1.15,
    documentation: 1.1,
    example: 1.05,
    source: 0.9,
    'source-internal': 0.85,
    test: 0.9,
    config: 0.85,
    other: 0.95,
  },
  debugging: {
    'documentation-primary': 1.0,
    documentation: 1.0,
    example: 1.05,
    source: 1.0, // Source code helps with debugging
    'source-internal': 0.95,
    test: 1.05, // Tests can show expected behavior
    config: 0.9,
    other: 1.0,
  },
};

// Known frameworks/technologies for context-aware boosting
const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; terms: string[] }> = [
  { pattern: /\bexpress\b/i, terms: ['express', 'expressjs', 'express.js'] },
  { pattern: /\bhono\b/i, terms: ['hono'] },
  { pattern: /\bzod\b/i, terms: ['zod'] },
  { pattern: /\breact\b/i, terms: ['react', 'reactjs', 'react.js'] },
  { pattern: /\bvue\b/i, terms: ['vue', 'vuejs', 'vue.js', 'vue3'] },
  { pattern: /\bnode\b/i, terms: ['node', 'nodejs', 'node.js'] },
  { pattern: /\btypescript\b/i, terms: ['typescript', 'ts'] },
  { pattern: /\bjwt\b/i, terms: ['jwt', 'jsonwebtoken', 'json-web-token'] },
];

// Pattern definitions for intent classification
const HOW_TO_PATTERNS = [
  /how (do|can|should|would) (i|you|we)/i,
  /how to\b/i,
  /what('s| is) the (best |right |correct )?(way|approach) to/i,
  /i (need|want|have) to/i,
  /show me how/i,
  /\bwhat's the syntax\b/i,
  /\bhow do i (use|create|make|set up|configure|implement|add|get)\b/i,
  /\bi'm (trying|building|creating|making)\b/i,
];

const IMPLEMENTATION_PATTERNS = [
  /how (does|is) .* (implemented|work internally)/i,
  /\binternal(ly)?\b/i,
  /\bsource code\b/i,
  /\bunder the hood\b/i,
  /\bimplementation (of|details?)\b/i,
];

const COMPARISON_PATTERNS = [
  /\b(vs\.?|versus)\b/i,
  /\bdifference(s)? between\b/i,
  /\bcompare\b/i,
  /\bshould (i|we) use .* or\b/i,
  /\bwhat's the difference\b/i,
  /\bwhich (one|is better)\b/i,
  /\bwhen (should|to) use\b/i,
];

const DEBUGGING_PATTERNS = [
  /\b(error|bug|issue|problem|crash|fail|broken|wrong)\b/i,
  /\bdoesn't (work|compile|run)\b/i,
  /\bisn't (working|updating|rendering)\b/i,
  /\bwhy (is|does|doesn't|isn't)\b/i,
  /\bwhat('s| is) (wrong|happening|going on)\b/i,
  /\bwhat am i doing wrong\b/i,
  /\bnot (working|updating|showing)\b/i,
  /\bhow do i (fix|debug|solve|resolve)\b/i,
];

const CONCEPTUAL_PATTERNS = [
  /\bwhat (is|are)\b/i,
  /\bexplain\b/i,
  /\bwhat does .* (mean|do)\b/i,
  /\bhow does .* work\b/i,
  /\bwhat('s| is) the (purpose|point|idea)\b/i,
];

/**
 * Classify query intents with confidence scores.
 * Returns all matching intents, allowing queries to have multiple intents.
 */
function classifyQueryIntents(query: string): ClassifiedIntent[] {
  const q = query.toLowerCase();
  const intents: ClassifiedIntent[] = [];

  // Check all pattern groups and add matching intents with confidence
  if (IMPLEMENTATION_PATTERNS.some((p) => p.test(q))) {
    intents.push({ intent: 'implementation', confidence: 0.9 });
  }

  if (DEBUGGING_PATTERNS.some((p) => p.test(q))) {
    intents.push({ intent: 'debugging', confidence: 0.85 });
  }

  if (COMPARISON_PATTERNS.some((p) => p.test(q))) {
    intents.push({ intent: 'comparison', confidence: 0.8 });
  }

  if (HOW_TO_PATTERNS.some((p) => p.test(q))) {
    intents.push({ intent: 'how-to', confidence: 0.75 });
  }

  if (CONCEPTUAL_PATTERNS.some((p) => p.test(q))) {
    intents.push({ intent: 'conceptual', confidence: 0.7 });
  }

  // If no patterns match, use how-to as the baseline intent
  if (intents.length === 0) {
    intents.push({ intent: 'how-to', confidence: 0.5 });
  }

  // Sort by confidence descending
  return intents.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get primary intent for logging/display purposes.
 */
function getPrimaryIntent(intents: ClassifiedIntent[]): QueryIntent {
  return intents[0]?.intent ?? 'how-to';
}

/**
 * RRF presets for different content types.
 * Web/docs content uses higher k to reduce noise from repetitive structure.
 */
const RRF_PRESETS = {
  code: { k: 20, vectorWeight: 0.6, ftsWeight: 0.4 },
  web: { k: 30, vectorWeight: 0.55, ftsWeight: 0.45 },
} as const;

/**
 * Detect if results are primarily web content (have urls vs file paths).
 */
function detectContentType(results: SearchResult[]): 'web' | 'code' {
  const webCount = results.filter((r) => 'url' in r.metadata).length;
  return webCount > results.length / 2 ? 'web' : 'code';
}

export class SearchService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly codeUnitService: CodeUnitService;
  private readonly codeGraphService: CodeGraphService | undefined;
  private readonly graphCache: Map<string, CodeGraph | null>;

  constructor(
    lanceStore: LanceStore,
    embeddingEngine: EmbeddingEngine,
    codeGraphService?: CodeGraphService
  ) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
    this.codeUnitService = new CodeUnitService();
    this.codeGraphService = codeGraphService;
    this.graphCache = new Map();
  }

  /**
   * Load code graph for a store, with caching.
   * Returns null if no graph is available.
   */
  private async loadGraphForStore(storeId: StoreId): Promise<CodeGraph | null> {
    if (!this.codeGraphService) return null;

    const cached = this.graphCache.get(storeId);
    if (cached !== undefined) return cached;

    const graph = await this.codeGraphService.loadGraph(storeId);
    const result = graph ?? null;
    this.graphCache.set(storeId, result);
    return result;
  }

  /**
   * Calculate confidence level based on max raw vector similarity score.
   * Configurable via environment variables.
   */
  private calculateConfidence(maxRawScore: number): SearchConfidence {
    const highThreshold = parseFloat(process.env['SEARCH_CONFIDENCE_HIGH'] ?? '0.5');
    const mediumThreshold = parseFloat(process.env['SEARCH_CONFIDENCE_MEDIUM'] ?? '0.3');

    if (maxRawScore >= highThreshold) return 'high';
    if (maxRawScore >= mediumThreshold) return 'medium';
    return 'low';
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const mode = query.mode ?? 'hybrid';
    const limit = query.limit ?? 10;
    const stores = query.stores ?? [];
    const detail = query.detail ?? 'minimal';
    const intents = classifyQueryIntents(query.query);
    const primaryIntent = getPrimaryIntent(intents);

    logger.debug(
      {
        query: query.query,
        mode,
        limit,
        stores,
        detail,
        intent: primaryIntent,
        intents,
        minRelevance: query.minRelevance,
      },
      'Search query received'
    );

    let allResults: SearchResult[] = [];
    let maxRawScore = 0;

    // Fetch more results than needed to allow for deduplication
    const fetchLimit = limit * 3;

    if (mode === 'vector') {
      // For vector mode, get raw scores first for confidence calculation
      const rawResults = await this.vectorSearchRaw(query.query, stores, fetchLimit);
      maxRawScore = rawResults.length > 0 ? (rawResults[0]?.score ?? 0) : 0;
      allResults = await this.vectorSearch(query.query, stores, fetchLimit, query.threshold);
    } else if (mode === 'fts') {
      // FTS mode doesn't have vector similarity, so no confidence calculation
      allResults = await this.ftsSearch(query.query, stores, fetchLimit);
    } else {
      // Hybrid: combine vector and FTS with RRF, get maxRawScore for confidence
      const hybridResult = await this.hybridSearchWithMetadata(
        query.query,
        stores,
        fetchLimit,
        query.threshold
      );
      allResults = hybridResult.results;
      maxRawScore = hybridResult.maxRawScore;
    }

    // Apply minRelevance filter - if max raw score is below threshold, return empty
    if (query.minRelevance !== undefined && maxRawScore < query.minRelevance) {
      const timeMs = Date.now() - startTime;
      logger.info(
        {
          query: query.query,
          mode,
          maxRawScore,
          minRelevance: query.minRelevance,
          timeMs,
        },
        'Search filtered by minRelevance - no sufficiently relevant results'
      );

      return {
        query: query.query,
        mode,
        stores,
        results: [],
        totalResults: 0,
        timeMs,
        confidence: this.calculateConfidence(maxRawScore),
        maxRawScore,
      };
    }

    // Deduplicate by source file - keep best chunk per source (considers query relevance)
    const dedupedResults = this.deduplicateBySource(allResults, query.query);
    const resultsToEnhance = dedupedResults.slice(0, limit);

    // Load code graphs for stores in results (for contextual/full detail levels)
    const graphs = new Map<string, CodeGraph | null>();
    if (detail === 'contextual' || detail === 'full') {
      const storeIds = new Set(resultsToEnhance.map((r) => r.metadata.storeId));
      for (const storeId of storeIds) {
        graphs.set(storeId, await this.loadGraphForStore(storeId));
      }
    }

    // Enhance results with progressive context
    const enhancedResults = resultsToEnhance.map((r) => {
      const graph = graphs.get(r.metadata.storeId) ?? null;
      return this.addProgressiveContext(r, query.query, detail, graph);
    });

    const timeMs = Date.now() - startTime;
    const confidence = mode !== 'fts' ? this.calculateConfidence(maxRawScore) : undefined;

    logger.info(
      {
        query: query.query,
        mode,
        resultCount: enhancedResults.length,
        dedupedFrom: allResults.length,
        intents: intents.map((i) => `${i.intent}(${i.confidence.toFixed(2)})`),
        maxRawScore: mode !== 'fts' ? maxRawScore : undefined,
        confidence,
        timeMs,
      },
      'Search complete'
    );

    return {
      query: query.query,
      mode,
      stores,
      results: enhancedResults,
      totalResults: enhancedResults.length,
      timeMs,
      confidence,
      maxRawScore: mode !== 'fts' ? maxRawScore : undefined,
    };
  }

  /**
   * Deduplicate results by source file path.
   * Keeps the best chunk for each unique source, considering both score and query relevance.
   */
  private deduplicateBySource(results: SearchResult[], query: string): SearchResult[] {
    const bySource = new Map<string, SearchResult>();
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    for (const result of results) {
      // Use file path as the source key (or url for web content, or id as last resort)
      const sourceKey = result.metadata.path ?? result.metadata.url ?? result.id;

      const existing = bySource.get(sourceKey);
      if (!existing) {
        bySource.set(sourceKey, result);
      } else {
        // Score-weighted relevance: accounts for fileType/framework boosts
        const existingTermCount = this.countQueryTerms(existing.content, queryTerms);
        const newTermCount = this.countQueryTerms(result.content, queryTerms);

        // Weight term count by score to account for ranking boosts
        const existingRelevance = existingTermCount * existing.score;
        const newRelevance = newTermCount * result.score;

        if (newRelevance > existingRelevance) {
          bySource.set(sourceKey, result);
        }
      }
    }

    // Return results sorted by score
    return Array.from(bySource.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Count how many query terms appear in the content.
   */
  private countQueryTerms(content: string, queryTerms: string[]): number {
    const lowerContent = content.toLowerCase();
    return queryTerms.filter((term) => lowerContent.includes(term)).length;
  }

  /**
   * Normalize scores to 0-1 range and optionally filter by threshold.
   * This ensures threshold values match displayed scores (UX consistency).
   *
   * Edge case handling:
   * - If there's only 1 result or all results have the same score, normalization
   *   would make them all 1.0. In this case, we keep the raw scores to allow
   *   threshold filtering to work meaningfully on absolute quality.
   */
  private normalizeAndFilterScores(results: SearchResult[], threshold?: number): SearchResult[] {
    if (results.length === 0) return [];

    // Sort by score descending
    const sorted = [...results].sort((a, b) => b.score - a.score);

    // Get score range for normalization
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (first === undefined || last === undefined) return [];

    const maxScore = first.score;
    const minScore = last.score;
    const range = maxScore - minScore;

    // Only normalize when there's meaningful score variation
    // If all scores are the same (range = 0), keep raw scores for threshold filtering
    const normalized =
      range > 0
        ? sorted.map((r) => ({
            ...r,
            score: Math.round(((r.score - minScore) / range) * 1000000) / 1000000,
          }))
        : sorted; // Keep raw scores when no variation (allows threshold to filter by quality)

    // Apply threshold filter on scores
    if (threshold !== undefined) {
      return normalized.filter((r) => r.score >= threshold);
    }

    return normalized;
  }

  /**
   * Fetch raw vector search results without normalization.
   * Returns results with raw cosine similarity scores [0-1].
   */
  private async vectorSearchRaw(
    query: string,
    stores: readonly StoreId[],
    limit: number
  ): Promise<SearchResult[]> {
    const queryVector = await this.embeddingEngine.embed(query);
    const results: SearchResult[] = [];

    for (const storeId of stores) {
      const hits = await this.lanceStore.search(storeId, queryVector, limit);
      results.push(
        ...hits.map((r) => ({
          id: r.id,
          score: r.score, // Raw cosine similarity (1 - distance)
          content: r.content,
          metadata: r.metadata,
        }))
      );
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async vectorSearch(
    query: string,
    stores: readonly StoreId[],
    limit: number,
    threshold?: number
  ): Promise<SearchResult[]> {
    const results = await this.vectorSearchRaw(query, stores, limit);

    // Normalize scores and apply threshold filter
    const normalized = this.normalizeAndFilterScores(results, threshold);
    return normalized.slice(0, limit);
  }

  private async ftsSearch(
    query: string,
    stores: readonly StoreId[],
    limit: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const storeId of stores) {
      const hits = await this.lanceStore.fullTextSearch(storeId, query, limit);
      results.push(
        ...hits.map((r) => ({
          id: r.id,
          score: r.score,
          content: r.content,
          metadata: r.metadata,
        }))
      );
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Internal hybrid search result with additional metadata for confidence calculation.
   */
  private async hybridSearchWithMetadata(
    query: string,
    stores: readonly StoreId[],
    limit: number,
    threshold?: number
  ): Promise<{ results: SearchResult[]; maxRawScore: number }> {
    // Classify query intents for context-aware ranking (supports multiple intents)
    const intents = classifyQueryIntents(query);

    // Get raw vector results (unnormalized) to track raw cosine similarity
    // We use these for both raw score tracking and as the basis for normalized vector results
    const rawVectorResults = await this.vectorSearchRaw(query, stores, limit * 2);

    // Build map of raw vector scores by document ID
    const rawVectorScores = new Map<string, number>();
    rawVectorResults.forEach((r) => {
      rawVectorScores.set(r.id, r.score);
    });

    // Track max raw score for confidence calculation
    const maxRawScore = rawVectorResults.length > 0 ? (rawVectorResults[0]?.score ?? 0) : 0;

    // Normalize raw vector results directly (avoids duplicate embedding call)
    // Don't apply threshold here - it's applied to final RRF-normalized scores at the end
    const vectorResults = this.normalizeAndFilterScores(rawVectorResults);

    // Get FTS results in parallel (only one call needed now)
    const ftsResults = await this.ftsSearch(query, stores, limit * 2);

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

    // Calculate RRF scores with file-type boosting and preserve ranking metadata
    const rrfScores: Array<{
      id: string;
      score: number;
      result: SearchResult;
      rawVectorScore: number | undefined;
      metadata: {
        vectorRank?: number;
        ftsRank?: number;
        vectorRRF: number;
        ftsRRF: number;
        fileTypeBoost: number;
        frameworkBoost: number;
        urlKeywordBoost: number;
        pathKeywordBoost: number;
        rawVectorScore?: number;
      };
    }> = [];

    // Select RRF config based on content type (web vs code)
    const contentType = detectContentType([...allDocs.values()]);
    const { k, vectorWeight, ftsWeight } = RRF_PRESETS[contentType];

    for (const [id, result] of allDocs) {
      const vectorRank = vectorRanks.get(id) ?? Infinity;
      const ftsRank = ftsRanks.get(id) ?? Infinity;
      const rawVectorScore = rawVectorScores.get(id);

      const vectorRRF = vectorRank !== Infinity ? vectorWeight / (k + vectorRank) : 0;
      const ftsRRF = ftsRank !== Infinity ? ftsWeight / (k + ftsRank) : 0;

      // Apply file-type boost (base + multi-intent-adjusted)
      const fileTypeBoost = this.getFileTypeBoost(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        result.metadata['fileType'] as string | undefined,
        intents
      );

      // Apply framework context boost
      const frameworkBoost = this.getFrameworkContextBoost(query, result);

      // Apply URL keyword boost (helps "troubleshooting" find /troubleshooting pages)
      const urlKeywordBoost = this.getUrlKeywordBoost(query, result);

      // Apply path keyword boost (helps "dispatcher" find async_dispatcher.py)
      const pathKeywordBoost = this.getPathKeywordBoost(query, result);

      const metadata: {
        vectorRank?: number;
        ftsRank?: number;
        vectorRRF: number;
        ftsRRF: number;
        fileTypeBoost: number;
        frameworkBoost: number;
        urlKeywordBoost: number;
        pathKeywordBoost: number;
        rawVectorScore?: number;
      } = {
        vectorRRF,
        ftsRRF,
        fileTypeBoost,
        frameworkBoost,
        urlKeywordBoost,
        pathKeywordBoost,
      };

      if (vectorRank !== Infinity) {
        metadata.vectorRank = vectorRank;
      }
      if (ftsRank !== Infinity) {
        metadata.ftsRank = ftsRank;
      }
      if (rawVectorScore !== undefined) {
        metadata.rawVectorScore = rawVectorScore;
      }

      rrfScores.push({
        id,
        score:
          (vectorRRF + ftsRRF) *
          fileTypeBoost *
          frameworkBoost *
          urlKeywordBoost *
          pathKeywordBoost,
        result,
        rawVectorScore,
        metadata,
      });
    }

    // Sort by RRF score
    const sorted = rrfScores.sort((a, b) => b.score - a.score).slice(0, limit);

    // Normalize scores to 0-1 range for better interpretability
    let normalizedResults: SearchResult[];

    if (sorted.length > 0) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (first === undefined || last === undefined) {
        normalizedResults = sorted.map((r) => ({
          ...r.result,
          score: r.score,
          rankingMetadata: r.metadata,
        }));
      } else {
        const maxScore = first.score;
        const minScore = last.score;
        const range = maxScore - minScore;

        if (range > 0) {
          // Round to avoid floating point precision issues in threshold comparisons
          normalizedResults = sorted.map((r) => ({
            ...r.result,
            score: Math.round(((r.score - minScore) / range) * 1000000) / 1000000,
            rankingMetadata: r.metadata,
          }));
        } else {
          // All same score - keep raw scores (allows threshold to filter by quality)
          normalizedResults = sorted.map((r) => ({
            ...r.result,
            score: r.score,
            rankingMetadata: r.metadata,
          }));
        }
      }
    } else {
      normalizedResults = [];
    }

    // Apply threshold filter on normalized scores (UX consistency)
    if (threshold !== undefined) {
      normalizedResults = normalizedResults.filter((r) => r.score >= threshold);
    }

    return { results: normalizedResults, maxRawScore };
  }

  async searchAllStores(query: SearchQuery, storeIds: StoreId[]): Promise<SearchResponse> {
    return this.search({
      ...query,
      stores: storeIds,
    });
  }

  /**
   * Get a score multiplier based on file type and query intent.
   * Documentation files get a strong boost to surface them higher.
   * Phase 4: Strengthened boosts for better documentation ranking.
   * Phase 1: Intent-based adjustments for context-aware ranking.
   */
  private getFileTypeBoost(fileType: string | undefined, intents: ClassifiedIntent[]): number {
    // Base file-type boosts
    let baseBoost: number;
    switch (fileType) {
      case 'documentation-primary':
        baseBoost = 1.8; // README, guides get very strong boost
        break;
      case 'documentation':
        baseBoost = 1.5; // docs/, tutorials/ get strong boost
        break;
      case 'example':
        baseBoost = 1.4; // examples/, demos/ are highly valuable
        break;
      case 'source':
        baseBoost = 1.0; // Source code baseline
        break;
      case 'source-internal':
        baseBoost = 0.75; // Internal implementation files (not too harsh)
        break;
      case 'test':
        baseBoost = parseFloat(process.env['SEARCH_TEST_FILE_BOOST'] ?? '0.5'); // Tests strongly penalized
        break;
      case 'config':
        baseBoost = 0.5; // Config files rarely answer questions
        break;
      default:
        baseBoost = 1.0;
    }

    // Blend intent-based multipliers weighted by confidence
    let weightedMultiplier = 0;
    let totalConfidence = 0;

    for (const { intent, confidence } of intents) {
      const intentBoosts = INTENT_FILE_BOOSTS[intent];
      const multiplier = intentBoosts[fileType ?? 'other'] ?? 1.0;
      weightedMultiplier += multiplier * confidence;
      totalConfidence += confidence;
    }

    const blendedMultiplier = totalConfidence > 0 ? weightedMultiplier / totalConfidence : 1.0;
    const finalBoost = baseBoost * blendedMultiplier;

    // Cap test file boost to prevent intent multipliers from overriding the penalty
    if (fileType === 'test') {
      return Math.min(finalBoost, 0.6);
    }

    return finalBoost;
  }

  /**
   * Get a score multiplier based on URL keyword matching.
   * Boosts results where URL path contains significant query keywords.
   * This helps queries like "troubleshooting" rank /troubleshooting pages first.
   */
  private getUrlKeywordBoost(query: string, result: SearchResult): number {
    const url = result.metadata.url;
    if (url === undefined || url === '') return 1.0;

    // Extract path segments from URL and normalize
    const urlPath = url.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

    // Common stop words to filter from queries
    const stopWords = new Set([
      'how',
      'to',
      'the',
      'a',
      'an',
      'is',
      'are',
      'what',
      'why',
      'when',
      'where',
      'can',
      'do',
      'does',
      'i',
      'my',
      'your',
      'it',
      'in',
      'on',
      'for',
      'with',
      'this',
      'that',
      'get',
      'use',
      'using',
    ]);

    // Extract meaningful query terms
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    if (queryTerms.length === 0) return 1.0;

    // Count matching terms in URL path
    const matchingTerms = queryTerms.filter((term) => urlPath.includes(term));

    if (matchingTerms.length === 0) return 1.0;

    // Boost based on proportion of matching terms
    // Single match: ~1.5, all terms match: ~2.0
    const matchRatio = matchingTerms.length / queryTerms.length;
    return 1.0 + 1.0 * matchRatio;
  }

  /**
   * Get a score multiplier based on file path keyword matching.
   * Boosts results where file path contains significant query keywords.
   * This helps queries like "dispatcher" rank async_dispatcher.py higher.
   */
  private getPathKeywordBoost(query: string, result: SearchResult): number {
    const path = result.metadata.path;
    if (path === undefined || path === '') return 1.0;

    // Extract path segments and normalize (split on slashes, dots, underscores, etc.)
    const pathSegments = path.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

    // Common stop words to filter from queries
    const stopWords = new Set([
      'how',
      'to',
      'the',
      'a',
      'an',
      'is',
      'are',
      'what',
      'why',
      'when',
      'where',
      'can',
      'do',
      'does',
      'i',
      'my',
      'your',
      'it',
      'in',
      'on',
      'for',
      'with',
      'this',
      'that',
      'get',
      'use',
      'using',
    ]);

    // Extract meaningful query terms
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));

    if (queryTerms.length === 0) return 1.0;

    // Count matching terms in file path
    const matchingTerms = queryTerms.filter((term) => pathSegments.includes(term));

    if (matchingTerms.length === 0) return 1.0;

    // Boost based on proportion of matching terms
    // Single match: ~1.5, all terms match: ~2.0
    const matchRatio = matchingTerms.length / queryTerms.length;
    return 1.0 + 1.0 * matchRatio;
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
        const resultMatchesFramework = terms.some(
          (term) => pathLower.includes(term) || content.includes(term)
        );

        if (resultMatchesFramework) {
          return 1.5; // Strong boost for matching framework
        } else {
          return 0.8; // Moderate penalty for non-matching when framework is specified
        }
      }
    }

    return 1.0; // No framework context in query
  }

  private addProgressiveContext(
    result: SearchResult,
    query: string,
    detail: DetailLevel,
    graph: CodeGraph | null
  ): SearchResult {
    const enhanced = { ...result };

    // Layer 1: Always add summary
    const path = result.metadata.path ?? result.metadata.url ?? 'unknown';
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fileType = result.metadata['fileType'] as string | undefined;

    // Try to extract code unit
    const codeUnit = this.extractCodeUnitFromResult(result);
    const symbolName = codeUnit?.name ?? this.extractSymbolName(result.content);

    enhanced.summary = {
      type: this.inferType(fileType, codeUnit),
      name: symbolName,
      signature: codeUnit?.signature ?? '',
      purpose: this.generatePurpose(result.content, query),
      location: `${path}${codeUnit ? `:${String(codeUnit.startLine)}` : ''}`,
      relevanceReason: this.generateRelevanceReason(result, query),
    };

    // Layer 2: Add context if requested
    if (detail === 'contextual' || detail === 'full') {
      // Get usage stats from code graph if available
      const usage = this.getUsageFromGraph(graph, path, symbolName);

      enhanced.context = {
        interfaces: this.extractInterfaces(result.content),
        keyImports: this.extractImports(result.content),
        relatedConcepts: this.extractConcepts(result.content, query),
        usage,
      };
    }

    // Layer 3: Add full context if requested
    if (detail === 'full') {
      // Get related code from graph if available
      const relatedCode = this.getRelatedCodeFromGraph(graph, path, symbolName);

      enhanced.full = {
        completeCode: codeUnit?.fullContent ?? result.content,
        relatedCode,
        documentation: this.extractDocumentation(result.content),
        tests: undefined,
      };
    }

    return enhanced;
  }

  private extractCodeUnitFromResult(result: SearchResult): CodeUnit | undefined {
    const path = result.metadata.path;
    if (path === undefined || path === '') return undefined;

    const ext = path.split('.').pop() ?? '';
    const language =
      ext === 'ts' || ext === 'tsx'
        ? 'typescript'
        : ext === 'js' || ext === 'jsx'
          ? 'javascript'
          : ext;

    // Try to find a symbol name in the content
    const symbolName = this.extractSymbolName(result.content);
    if (symbolName === '') return undefined;

    return this.codeUnitService.extractCodeUnit(result.content, symbolName, language);
  }

  private extractSymbolName(content: string): string {
    // Extract function or class name
    const funcMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch?.[1] !== undefined && funcMatch[1] !== '') return funcMatch[1];

    const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch?.[1] !== undefined && classMatch[1] !== '') return classMatch[1];

    const constMatch = content.match(/(?:export\s+)?const\s+(\w+)/);
    if (constMatch?.[1] !== undefined && constMatch[1] !== '') return constMatch[1];

    // Fallback: return "(anonymous)" for unnamed symbols
    return '(anonymous)';
  }

  private inferType(
    fileType: string | undefined,
    codeUnit: CodeUnit | undefined
  ): import('../types/search.js').ResultSummary['type'] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if (codeUnit) return codeUnit.type as import('../types/search.js').ResultSummary['type'];
    if (fileType === 'documentation' || fileType === 'documentation-primary')
      return 'documentation';
    return 'function';
  }

  private generatePurpose(content: string, query: string): string {
    // Extract first line of JSDoc comment if present
    const docMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
    if (docMatch?.[1] !== undefined && docMatch[1] !== '') return docMatch[1].trim();

    const lines = content.split('\n');
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Helper to check if line is skippable (imports, declarations)
    const shouldSkip = (cleaned: string): boolean => {
      return (
        cleaned.startsWith('import ') ||
        cleaned.startsWith('export ') ||
        cleaned.startsWith('interface ') ||
        cleaned.startsWith('type ')
      );
    };

    // Helper to score a line based on query term matches
    const scoreLine = (cleaned: string): number => {
      const lowerLine = cleaned.toLowerCase();
      return queryTerms.filter((term) => lowerLine.includes(term)).length;
    };

    // Helper to check if line is meaningful (length, not a comment)
    const isMeaningful = (cleaned: string): boolean => {
      if (cleaned.length === 0) return false;
      if (cleaned.startsWith('//') || cleaned.startsWith('/*')) return false;
      // Accept Markdown headings
      if (cleaned.startsWith('#') && cleaned.length > 3) return true;
      // Accept lines 15+ chars
      return cleaned.length >= 15;
    };

    // First pass: find lines with query terms, preferring complete sentences
    let bestLine: string | null = null;
    let bestScore = 0;

    for (const line of lines) {
      const cleaned = line.trim();
      if (shouldSkip(cleaned) || !isMeaningful(cleaned)) continue;

      let score = scoreLine(cleaned);

      // Boost score for complete sentences (end with period, !, ?)
      if (/[.!?]$/.test(cleaned)) {
        score += 0.5;
      }

      // Boost score for code examples (contains function calls or assignments)
      // Favor complete patterns: function calls WITH arguments, assignments with values
      if (/\w+\([^)]*\)|=\s*\w+\(|=>/.test(cleaned)) {
        score += 0.6; // Enhanced boost to preserve code examples in snippets
      }

      if (score > bestScore) {
        bestScore = score;
        bestLine = cleaned;
      }
    }

    // If we found a line with query terms, use it
    if (bestLine !== null && bestLine !== '' && bestScore > 0) {
      if (bestLine.length > 150) {
        const firstSentence = bestLine.match(/^[^.!?]+[.!?]/);
        if (firstSentence && firstSentence[0].length >= 20 && firstSentence[0].length <= 150) {
          return firstSentence[0].trim();
        }
        return `${bestLine.substring(0, 147)}...`;
      }
      return bestLine;
    }

    // Fallback: first meaningful line (original logic)
    for (const line of lines) {
      const cleaned = line.trim();
      if (shouldSkip(cleaned) || !isMeaningful(cleaned)) continue;

      if (cleaned.length > 150) {
        const firstSentence = cleaned.match(/^[^.!?]+[.!?]/);
        if (firstSentence && firstSentence[0].length >= 20 && firstSentence[0].length <= 150) {
          return firstSentence[0].trim();
        }
        return `${cleaned.substring(0, 147)}...`;
      }

      return cleaned;
    }

    return 'Code related to query';
  }

  private generateRelevanceReason(result: SearchResult, query: string): string {
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const contentLower = result.content.toLowerCase();

    const matchedTerms = queryTerms.filter((term) => contentLower.includes(term));

    if (matchedTerms.length > 0) {
      return `Matches: ${matchedTerms.join(', ')}`;
    }

    return 'Semantically similar to query';
  }

  private extractInterfaces(content: string): string[] {
    const interfaces: string[] = [];
    const matches = content.matchAll(/interface\s+(\w+)/g);
    for (const match of matches) {
      if (match[1] !== undefined && match[1] !== '') interfaces.push(match[1]);
    }
    return interfaces;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const matches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    for (const match of matches) {
      if (match[1] !== undefined && match[1] !== '') imports.push(match[1]);
    }
    return imports.slice(0, 5); // Top 5
  }

  private extractConcepts(content: string, _query: string): string[] {
    // TODO: Use _query parameter to prioritize query-related concepts in future enhancement

    // Common stopwords to filter out
    const stopwords = new Set([
      'this',
      'that',
      'these',
      'those',
      'from',
      'with',
      'have',
      'will',
      'would',
      'should',
      'could',
      'about',
      'been',
      'were',
      'being',
      'function',
      'return',
      'const',
      'import',
      'export',
      'default',
      'type',
      'interface',
      'class',
      'extends',
      'implements',
      'async',
      'await',
      'then',
      'catch',
      'throw',
      'error',
      'undefined',
      'null',
      'true',
      'false',
      'void',
      'number',
      'string',
      'boolean',
      'object',
      'array',
      'promise',
      'callback',
      'resolve',
      'reject',
      'value',
      'param',
      'params',
      'args',
      'props',
      'options',
      'config',
      'data',
    ]);

    // Simple keyword extraction
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    const frequency = new Map<string, number>();

    for (const word of words) {
      // Skip stopwords
      if (stopwords.has(word)) continue;

      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private extractDocumentation(content: string): string {
    const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (docMatch?.[1] !== undefined && docMatch[1] !== '') {
      return docMatch[1]
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, '').trim())
        .filter((line) => line.length > 0)
        .join('\n');
    }
    return '';
  }

  /**
   * Get usage stats from code graph.
   * Returns default values if no graph is available.
   */
  private getUsageFromGraph(
    graph: CodeGraph | null,
    filePath: string,
    symbolName: string
  ): { calledBy: number; calls: number } {
    if (!graph || symbolName === '' || symbolName === '(anonymous)') {
      return { calledBy: 0, calls: 0 };
    }

    const nodeId = `${filePath}:${symbolName}`;
    return {
      calledBy: graph.getCalledByCount(nodeId),
      calls: graph.getCallsCount(nodeId),
    };
  }

  /**
   * Get related code from graph.
   * Returns callers and callees for the symbol.
   */
  private getRelatedCodeFromGraph(
    graph: CodeGraph | null,
    filePath: string,
    symbolName: string
  ): Array<{ file: string; summary: string; relationship: string }> {
    if (!graph || symbolName === '' || symbolName === '(anonymous)') {
      return [];
    }

    const nodeId = `${filePath}:${symbolName}`;
    const related: Array<{ file: string; summary: string; relationship: string }> = [];

    // Get callers (incoming edges)
    const incoming = graph.getIncomingEdges(nodeId);
    for (const edge of incoming) {
      if (edge.type === 'calls') {
        // Parse file:symbol from edge.from
        const [file, symbol] = this.parseNodeId(edge.from);
        related.push({
          file,
          summary: symbol ? `${symbol}()` : 'unknown',
          relationship: 'calls this',
        });
      }
    }

    // Get callees (outgoing edges)
    const outgoing = graph.getEdges(nodeId);
    for (const edge of outgoing) {
      if (edge.type === 'calls') {
        // Parse file:symbol from edge.to
        const [file, symbol] = this.parseNodeId(edge.to);
        related.push({
          file,
          summary: symbol ? `${symbol}()` : 'unknown',
          relationship: 'called by this',
        });
      }
    }

    // Limit to top 10 related items
    return related.slice(0, 10);
  }

  /**
   * Parse a node ID into file path and symbol name.
   */
  private parseNodeId(nodeId: string): [string, string] {
    const lastColon = nodeId.lastIndexOf(':');
    if (lastColon === -1) {
      return [nodeId, ''];
    }
    return [nodeId.substring(0, lastColon), nodeId.substring(lastColon + 1)];
  }
}
