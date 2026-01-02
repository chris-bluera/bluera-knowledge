import type { LanceStore } from '../db/lance.js';
import type { EmbeddingEngine } from '../db/embeddings.js';
import type { SearchQuery, SearchResponse, SearchResult, DetailLevel } from '../types/search.js';
import type { StoreId } from '../types/brands.js';
import { CodeUnitService } from './code-unit.service.js';
import type { CodeUnit } from '../types/search.js';
import type { CodeGraphService } from './code-graph.service.js';
import type { CodeGraph } from '../analysis/code-graph.js';

/**
 * Query intent classification for context-aware ranking.
 * Phase 1: Different intents prioritize different content types.
 */
export type QueryIntent = 'how-to' | 'implementation' | 'conceptual' | 'comparison' | 'debugging';

/**
 * Intent-based file type multipliers - CONSERVATIVE version.
 * Applied on top of base file-type boosts.
 * Lessons learned: Too-aggressive penalties hurt when corpus lacks ideal content.
 * These values provide gentle guidance rather than dramatic reranking.
 */
const INTENT_FILE_BOOSTS: Record<QueryIntent, Record<string, number>> = {
  'how-to': {
    'documentation-primary': 1.3,   // Strong boost for docs
    'documentation': 1.2,
    'example': 1.5,                  // Examples are ideal for "how to"
    'source': 0.85,                 // Moderate penalty - source might still have good content
    'source-internal': 0.7,         // Stronger penalty - internal code less useful
    'test': 0.8,
    'config': 0.7,
    'other': 0.9,
  },
  'implementation': {
    'documentation-primary': 0.95,
    'documentation': 1.0,
    'example': 1.0,
    'source': 1.1,                  // Slight boost for source code
    'source-internal': 1.05,        // Internal code can be relevant
    'test': 1.0,
    'config': 0.95,
    'other': 1.0,
  },
  'conceptual': {
    'documentation-primary': 1.1,
    'documentation': 1.05,
    'example': 1.0,
    'source': 0.95,
    'source-internal': 0.9,
    'test': 0.9,
    'config': 0.85,
    'other': 0.95,
  },
  'comparison': {
    'documentation-primary': 1.15,
    'documentation': 1.1,
    'example': 1.05,
    'source': 0.9,
    'source-internal': 0.85,
    'test': 0.9,
    'config': 0.85,
    'other': 0.95,
  },
  'debugging': {
    'documentation-primary': 1.0,
    'documentation': 1.0,
    'example': 1.05,
    'source': 1.0,                  // Source code helps with debugging
    'source-internal': 0.95,
    'test': 1.05,                   // Tests can show expected behavior
    'config': 0.9,
    'other': 1.0,
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

/**
 * Classify the intent of a search query.
 * This helps adjust ranking based on what kind of answer the user wants.
 */
function classifyQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  // How-to patterns: user wants to learn how to use/do something
  const howToPatterns = [
    /how (do|can|should|would) (i|you|we)/i,
    /how to\b/i,
    /what('s| is) the (best |right |correct )?(way|approach) to/i,
    /i (need|want|have) to/i,
    /show me how/i,
    /\bwhat's the syntax\b/i,
    /\bhow do i (use|create|make|set up|configure|implement|add|get)\b/i,
    /\bi'm (trying|building|creating|making)\b/i,
  ];

  // Implementation patterns: user wants to understand internals
  const implementationPatterns = [
    /how (does|is) .* (implemented|work internally)/i,
    /\binternal(ly)?\b/i,
    /\bsource code\b/i,
    /\bunder the hood\b/i,
    /\bimplementation (of|details?)\b/i,
  ];

  // Comparison patterns: user is deciding between options
  const comparisonPatterns = [
    /\b(vs\.?|versus)\b/i,
    /\bdifference(s)? between\b/i,
    /\bcompare\b/i,
    /\bshould (i|we) use .* or\b/i,
    /\bwhat's the difference\b/i,
    /\bwhich (one|is better)\b/i,
    /\bwhen (should|to) use\b/i,
  ];

  // Debugging patterns: user is troubleshooting a problem
  const debuggingPatterns = [
    /\b(error|bug|issue|problem|crash|fail|broken|wrong)\b/i,
    /\bdoesn't (work|compile|run)\b/i,
    /\bisn't (working|updating|rendering)\b/i,
    /\bwhy (is|does|doesn't|isn't)\b/i,
    /\bwhat('s| is) (wrong|happening|going on)\b/i,
    /\bwhat am i doing wrong\b/i,
    /\bnot (working|updating|showing)\b/i,
    /\bhow do i (fix|debug|solve|resolve)\b/i,
  ];

  // Conceptual patterns: user wants to understand a concept
  const conceptualPatterns = [
    /\bwhat (is|are)\b/i,
    /\bexplain\b/i,
    /\bwhat does .* (mean|do)\b/i,
    /\bhow does .* work\b/i,
    /\bwhat('s| is) the (purpose|point|idea)\b/i,
  ];

  // Check patterns in order of specificity
  if (implementationPatterns.some(p => p.test(q))) {
    return 'implementation';
  }

  if (debuggingPatterns.some(p => p.test(q))) {
    return 'debugging';
  }

  if (comparisonPatterns.some(p => p.test(q))) {
    return 'comparison';
  }

  if (howToPatterns.some(p => p.test(q))) {
    return 'how-to';
  }

  if (conceptualPatterns.some(p => p.test(q))) {
    return 'conceptual';
  }

  // Default to how-to as most queries are seeking practical usage
  return 'how-to';
}

interface RRFConfig {
  k: number;
  vectorWeight: number;
  ftsWeight: number;
}

export class SearchService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly rrfConfig: RRFConfig;
  private readonly codeUnitService: CodeUnitService;
  private readonly codeGraphService: CodeGraphService | undefined;
  private readonly graphCache: Map<string, CodeGraph | null>;

  constructor(
    lanceStore: LanceStore,
    embeddingEngine: EmbeddingEngine,
    // Lower k value (20 vs 60) produces more differentiated scores for top results
    rrfConfig: RRFConfig = { k: 20, vectorWeight: 0.6, ftsWeight: 0.4 },
    codeGraphService?: CodeGraphService
  ) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
    this.rrfConfig = rrfConfig;
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

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const mode = query.mode ?? 'hybrid';
    const limit = query.limit ?? 10;
    const stores = query.stores ?? [];
    const detail = query.detail ?? 'minimal';

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

    // Deduplicate by source file - keep best chunk per source (considers query relevance)
    const dedupedResults = this.deduplicateBySource(allResults, query.query);
    const resultsToEnhance = dedupedResults.slice(0, limit);

    // Load code graphs for stores in results (for contextual/full detail levels)
    const graphs = new Map<string, CodeGraph | null>();
    if (detail === 'contextual' || detail === 'full') {
      const storeIds = new Set(resultsToEnhance.map(r => r.metadata.storeId));
      for (const storeId of storeIds) {
        graphs.set(storeId, await this.loadGraphForStore(storeId));
      }
    }

    // Enhance results with progressive context
    const enhancedResults = resultsToEnhance.map(r => {
      const graph = graphs.get(r.metadata.storeId) ?? null;
      return this.addProgressiveContext(r, query.query, detail, graph);
    });

    return {
      query: query.query,
      mode,
      stores,
      results: enhancedResults,
      totalResults: enhancedResults.length,
      timeMs: Date.now() - startTime,
    };
  }

  /**
   * Deduplicate results by source file path.
   * Keeps the best chunk for each unique source, considering both score and query relevance.
   */
  private deduplicateBySource(results: SearchResult[], query: string): SearchResult[] {
    const bySource = new Map<string, SearchResult>();
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    for (const result of results) {
      // Use file path as the source key, fallback to document ID
      const sourceKey = result.metadata.path ?? result.metadata.url ?? result.id;

      const existing = bySource.get(sourceKey);
      if (!existing) {
        bySource.set(sourceKey, result);
      } else {
        // Compare: prefer chunk with more query terms in content
        const existingTermCount = this.countQueryTerms(existing.content, queryTerms);
        const newTermCount = this.countQueryTerms(result.content, queryTerms);

        // Prefer chunk with more query terms, or higher score if same
        if (newTermCount > existingTermCount ||
            (newTermCount === existingTermCount && result.score > existing.score)) {
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
    return queryTerms.filter(term => lowerContent.includes(term)).length;
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
    // Phase 1: Classify query intent for context-aware ranking
    const intent = classifyQueryIntent(query);

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

    // Calculate RRF scores with file-type boosting and preserve ranking metadata
    const rrfScores: Array<{
      id: string;
      score: number;
      result: SearchResult;
      metadata: {
        vectorRank?: number;
        ftsRank?: number;
        vectorRRF: number;
        ftsRRF: number;
        fileTypeBoost: number;
        frameworkBoost: number;
      };
    }> = [];
    const { k, vectorWeight, ftsWeight } = this.rrfConfig;

    for (const [id, result] of allDocs) {
      const vectorRank = vectorRanks.get(id) ?? Infinity;
      const ftsRank = ftsRanks.get(id) ?? Infinity;

      const vectorRRF = vectorRank !== Infinity ? vectorWeight / (k + vectorRank) : 0;
      const ftsRRF = ftsRank !== Infinity ? ftsWeight / (k + ftsRank) : 0;

      // Apply file-type boost (base + intent-adjusted)
      const fileTypeBoost = this.getFileTypeBoost(
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        result.metadata['fileType'] as string | undefined,
        intent
      );

      // Apply framework context boost
      const frameworkBoost = this.getFrameworkContextBoost(query, result);

      const metadata: {
        vectorRank?: number;
        ftsRank?: number;
        vectorRRF: number;
        ftsRRF: number;
        fileTypeBoost: number;
        frameworkBoost: number;
      } = {
        vectorRRF,
        ftsRRF,
        fileTypeBoost,
        frameworkBoost,
      };

      if (vectorRank !== Infinity) {
        metadata.vectorRank = vectorRank;
      }
      if (ftsRank !== Infinity) {
        metadata.ftsRank = ftsRank;
      }

      rrfScores.push({
        id,
        score: (vectorRRF + ftsRRF) * fileTypeBoost * frameworkBoost,
        result,
        metadata,
      });
    }

    // Sort by RRF score
    const sorted = rrfScores.sort((a, b) => b.score - a.score).slice(0, limit);

    // Normalize scores to 0-1 range for better interpretability
    if (sorted.length > 0) {
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      if (first === undefined || last === undefined) {
        return sorted.map(r => ({
          ...r.result,
          score: r.score,
          rankingMetadata: r.metadata,
        }));
      }
      const maxScore = first.score;
      const minScore = last.score;
      const range = maxScore - minScore;

      if (range > 0) {
        return sorted.map(r => ({
          ...r.result,
          score: (r.score - minScore) / range,
          rankingMetadata: r.metadata,
        }));
      }
    }

    return sorted.map(r => ({
      ...r.result,
      score: r.score,
      rankingMetadata: r.metadata,
    }));
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
   * Get a score multiplier based on file type and query intent.
   * Documentation files get a strong boost to surface them higher.
   * Phase 4: Strengthened boosts for better documentation ranking.
   * Phase 1: Intent-based adjustments for context-aware ranking.
   */
  private getFileTypeBoost(fileType: string | undefined, intent: QueryIntent): number {
    // Base file-type boosts
    let baseBoost: number;
    switch (fileType) {
      case 'documentation-primary':
        baseBoost = 1.8;  // README, guides get very strong boost
        break;
      case 'documentation':
        baseBoost = 1.5;  // docs/, tutorials/ get strong boost
        break;
      case 'example':
        baseBoost = 1.4;  // examples/, demos/ are highly valuable
        break;
      case 'source':
        baseBoost = 1.0;  // Source code baseline
        break;
      case 'source-internal':
        baseBoost = 0.75;  // Internal implementation files (not too harsh)
        break;
      case 'test':
        baseBoost = 0.7;  // Tests significantly lower
        break;
      case 'config':
        baseBoost = 0.5;  // Config files rarely answer questions
        break;
      default:
        baseBoost = 1.0;
    }

    // Apply intent-based multiplier
    const intentBoosts = INTENT_FILE_BOOSTS[intent];
    const intentMultiplier = intentBoosts[fileType ?? 'other'] ?? 1.0;

    return baseBoost * intentMultiplier;
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
      location: `${path}${codeUnit ? ':' + String(codeUnit.startLine) : ''}`,
      relevanceReason: this.generateRelevanceReason(result, query)
    };

    // Layer 2: Add context if requested
    if (detail === 'contextual' || detail === 'full') {
      // Get usage stats from code graph if available
      const usage = this.getUsageFromGraph(graph, path, symbolName);

      enhanced.context = {
        interfaces: this.extractInterfaces(result.content),
        keyImports: this.extractImports(result.content),
        relatedConcepts: this.extractConcepts(result.content, query),
        usage
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
        tests: undefined
      };
    }

    return enhanced;
  }

  private extractCodeUnitFromResult(result: SearchResult): CodeUnit | undefined {
    const path = result.metadata.path;
    if (path === undefined || path === '') return undefined;

    const ext = path.split('.').pop() ?? '';
    const language = ext === 'ts' || ext === 'tsx' ? 'typescript' :
                     ext === 'js' || ext === 'jsx' ? 'javascript' : ext;

    // Try to find a symbol name in the content
    const symbolName = this.extractSymbolName(result.content);
    if (symbolName === '') return undefined;

    return this.codeUnitService.extractCodeUnit(result.content, symbolName, language);
  }

  private extractSymbolName(content: string): string {
    // Extract function or class name
    const funcMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch !== null && funcMatch[1] !== undefined && funcMatch[1] !== '') return funcMatch[1];

    const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch !== null && classMatch[1] !== undefined && classMatch[1] !== '') return classMatch[1];

    const constMatch = content.match(/(?:export\s+)?const\s+(\w+)/);
    if (constMatch !== null && constMatch[1] !== undefined && constMatch[1] !== '') return constMatch[1];

    // Fallback: return "(anonymous)" for unnamed symbols
    return '(anonymous)';
  }

  private inferType(fileType: string | undefined, codeUnit: CodeUnit | undefined): import('../types/search.js').ResultSummary['type'] {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    if (codeUnit) return codeUnit.type as import('../types/search.js').ResultSummary['type'];
    if (fileType === 'documentation' || fileType === 'documentation-primary') return 'documentation';
    return 'function';
  }

  private generatePurpose(content: string, query: string): string {
    // Extract first line of JSDoc comment if present
    const docMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
    if (docMatch !== null && docMatch[1] !== undefined && docMatch[1] !== '') return docMatch[1].trim();

    const lines = content.split('\n');
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

    // Helper to check if line is skippable (imports, declarations)
    const shouldSkip = (cleaned: string): boolean => {
      return cleaned.startsWith('import ') ||
             cleaned.startsWith('export ') ||
             cleaned.startsWith('interface ') ||
             cleaned.startsWith('type ');
    };

    // Helper to score a line based on query term matches
    const scoreLine = (cleaned: string): number => {
      const lowerLine = cleaned.toLowerCase();
      return queryTerms.filter(term => lowerLine.includes(term)).length;
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
        score += 0.6;  // Enhanced boost to preserve code examples in snippets
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
        return bestLine.substring(0, 147) + '...';
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
        return cleaned.substring(0, 147) + '...';
      }

      return cleaned;
    }

    return 'Code related to query';
  }

  private generateRelevanceReason(result: SearchResult, query: string): string {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const contentLower = result.content.toLowerCase();

    const matchedTerms = queryTerms.filter(term => contentLower.includes(term));

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
      'this', 'that', 'these', 'those', 'from', 'with', 'have', 'will',
      'would', 'should', 'could', 'about', 'been', 'were', 'being',
      'function', 'return', 'const', 'import', 'export', 'default',
      'type', 'interface', 'class', 'extends', 'implements', 'async',
      'await', 'then', 'catch', 'throw', 'error', 'undefined', 'null',
      'true', 'false', 'void', 'number', 'string', 'boolean', 'object',
      'array', 'promise', 'callback', 'resolve', 'reject', 'value',
      'param', 'params', 'args', 'props', 'options', 'config', 'data'
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
    if (docMatch !== null && docMatch[1] !== undefined && docMatch[1] !== '') {
      return docMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line.length > 0)
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
      calls: graph.getCallsCount(nodeId)
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
          relationship: 'calls this'
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
          relationship: 'called by this'
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
