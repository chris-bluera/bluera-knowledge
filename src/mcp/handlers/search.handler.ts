import { createLogger, summarizePayload } from '../../logging/index.js';
import { estimateTokens, formatTokenCount } from '../../services/token.service.js';
import { LRUCache } from '../cache.js';
import { SearchArgsSchema, GetFullContextArgsSchema } from '../schemas/index.js';
import type { SearchQuery, DocumentId, StoreId } from '../../types/index.js';
import type { SearchResult } from '../../types/search.js';
import type { SearchArgs, GetFullContextArgs } from '../schemas/index.js';
import type { ToolHandler, ToolResponse } from '../types.js';

const logger = createLogger('mcp-search');

// Create result cache for get_full_context
// Uses LRU cache to prevent memory leaks (max 1000 items)
export const resultCache = new LRUCache<DocumentId, SearchResult>(1000);

/**
 * Handle search requests
 *
 * Searches across specified stores (or all stores if none specified) using
 * hybrid vector + FTS search. Results are cached for get_full_context retrieval.
 */
export const handleSearch: ToolHandler<SearchArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = SearchArgsSchema.parse(args);

  logger.info(
    {
      query: validated.query,
      stores: validated.stores,
      detail: validated.detail,
      limit: validated.limit,
      intent: validated.intent,
    },
    'Search started'
  );

  const { services } = context;

  // Get all stores if none specified, resolve store names to IDs
  const storeIds: StoreId[] =
    validated.stores !== undefined
      ? await Promise.all(
          validated.stores.map(async (s) => {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const store = await services.store.getByIdOrName(s as StoreId);
            if (!store) {
              throw new Error(`Store not found: ${s}`);
            }
            return store.id;
          })
        )
      : (await services.store.list()).map((s) => s.id);

  // Initialize stores with error handling
  try {
    for (const storeId of storeIds) {
      await services.lance.initialize(storeId);
    }
  } catch (error) {
    throw new Error(
      `Failed to initialize vector stores: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Perform search
  const searchQuery: SearchQuery = {
    query: validated.query,
    stores: storeIds,
    mode: 'hybrid',
    limit: validated.limit,
    detail: validated.detail,
  };

  const results = await services.search.search(searchQuery);

  // Cache results for get_full_context (with LRU eviction)
  for (const result of results.results) {
    resultCache.set(result.id, result);
  }

  // Add repoRoot to results for cloned repos
  const enhancedResults = await Promise.all(
    results.results.map(async (r) => {
      const storeId = r.metadata.storeId;
      const store = await services.store.getByIdOrName(storeId);

      return {
        id: r.id,
        score: r.score,
        summary: {
          ...r.summary,
          storeName: store?.name,
          repoRoot: store?.type === 'repo' ? store.path : undefined,
        },
        context: r.context,
        full: r.full,
      };
    })
  );

  const responseJson = JSON.stringify(
    {
      results: enhancedResults,
      totalResults: results.totalResults,
      mode: results.mode,
      timeMs: results.timeMs,
    },
    null,
    2
  );

  // Calculate actual token estimate based on response content
  const responseTokens = estimateTokens(responseJson);

  // Create visible header with token usage
  const header = `Search: "${validated.query}" | Results: ${String(results.totalResults)} | ${formatTokenCount(responseTokens)} tokens | ${String(results.timeMs)}ms\n\n`;

  // Log the complete MCP response that will be sent to Claude Code
  logger.info(
    {
      query: validated.query,
      totalResults: results.totalResults,
      responseTokens,
      timeMs: results.timeMs,
      ...summarizePayload(responseJson, 'mcp-response', validated.query),
    },
    'Search complete - context sent to Claude Code'
  );

  return {
    content: [
      {
        type: 'text',
        text: header + responseJson,
      },
    ],
  };
};

/**
 * Handle get_full_context requests
 *
 * Retrieves full context for a previously cached search result.
 * If the result isn't already full, re-queries with full detail level.
 */
export const handleGetFullContext: ToolHandler<GetFullContextArgs> = async (
  args,
  context
): Promise<ToolResponse> => {
  // Validate arguments with Zod
  const validated = GetFullContextArgsSchema.parse(args);

  logger.info({ resultId: validated.resultId }, 'Get full context requested');

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const resultId = validated.resultId as DocumentId;

  // Check cache for result
  const cachedResult = resultCache.get(resultId);

  if (!cachedResult) {
    throw new Error(`Result not found in cache: ${resultId}. Run a search first to cache results.`);
  }

  // If result already has full context, return it
  if (cachedResult.full) {
    const responseJson = JSON.stringify(
      {
        id: cachedResult.id,
        score: cachedResult.score,
        summary: cachedResult.summary,
        context: cachedResult.context,
        full: cachedResult.full,
      },
      null,
      2
    );

    logger.info(
      {
        resultId,
        cached: true,
        hasFullContext: true,
        ...summarizePayload(responseJson, 'mcp-full-context', resultId),
      },
      'Full context retrieved from cache'
    );

    return {
      content: [
        {
          type: 'text',
          text: responseJson,
        },
      ],
    };
  }

  // Otherwise, re-query with full detail
  const { services } = context;
  const store = await services.store.getByIdOrName(cachedResult.metadata.storeId);

  if (!store) {
    throw new Error(`Store not found: ${cachedResult.metadata.storeId}`);
  }

  await services.lance.initialize(store.id);

  const searchQuery: SearchQuery = {
    query: cachedResult.content.substring(0, 100), // Use snippet of content as query
    stores: [store.id],
    mode: 'hybrid',
    limit: 1,
    detail: 'full',
  };

  const results = await services.search.search(searchQuery);

  // Find matching result by ID
  const fullResult = results.results.find((r) => r.id === resultId);

  if (!fullResult) {
    // Return cached result even if we couldn't get full detail
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              id: cachedResult.id,
              score: cachedResult.score,
              summary: cachedResult.summary,
              context: cachedResult.context,
              warning: 'Could not retrieve full context, returning cached minimal result',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Update cache with full result
  resultCache.set(resultId, fullResult);

  const responseJson = JSON.stringify(
    {
      id: fullResult.id,
      score: fullResult.score,
      summary: fullResult.summary,
      context: fullResult.context,
      full: fullResult.full,
    },
    null,
    2
  );

  logger.info(
    {
      resultId,
      cached: false,
      hasFullContext: true,
      ...summarizePayload(responseJson, 'mcp-full-context', resultId),
    },
    'Full context retrieved via re-query'
  );

  return {
    content: [
      {
        type: 'text',
        text: responseJson,
      },
    ],
  };
};
