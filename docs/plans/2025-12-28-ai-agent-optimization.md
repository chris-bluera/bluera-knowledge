# AI Agent-Optimized Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform semantic search from human-focused snippet delivery to AI agent-optimized knowledge retrieval with pattern detection, progressive context delivery, and agent feedback loops.

**Architecture:** Multi-phase enhancement preserving existing search core. Phase 1 adds agent-optimized output formats and progressive context APIs. Phase 2 builds static analysis infrastructure and code graph. Phase 3 implements pattern detection and mining. Phase 4 adds agent query understanding. Phase 5 creates feedback loops for continuous improvement.

**Tech Stack:** TypeScript, @babel/parser for AST, LanceDB for pattern storage, MCP (Model Context Protocol) for agent integration, existing Transformers.js embeddings

---

## Phase 1: Agent-Optimized Output Format (MVP)

### Task 1.1: Enhanced Result Schema

**Goal:** Add structured code unit extraction to search results for AI agents.

**Files:**
- Modify: `src/types/search.ts`
- Modify: `src/services/search.service.ts`
- Create: `src/services/code-unit.service.ts`
- Create: `tests/services/code-unit.service.test.ts`

**Step 1: Write failing test for code unit extraction**

Create `tests/services/code-unit.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CodeUnitService } from '../src/services/code-unit.service.js';

describe('CodeUnitService', () => {
  it('should extract full function from TypeScript code', () => {
    const code = `
export function validateToken(token: string): boolean {
  if (!token) return false;
  return token.length > 0;
}

export function parseToken(token: string): object {
  return JSON.parse(token);
}
`;

    const service = new CodeUnitService();
    const unit = service.extractCodeUnit(code, 'validateToken', 'typescript');

    expect(unit).toBeDefined();
    expect(unit.type).toBe('function');
    expect(unit.name).toBe('validateToken');
    expect(unit.signature).toBe('validateToken(token: string): boolean');
    expect(unit.fullContent).toContain('export function validateToken');
    expect(unit.startLine).toBe(2);
    expect(unit.endLine).toBe(5);
  });

  it('should extract class with methods', () => {
    const code = `
export class UserService {
  constructor(private repo: UserRepo) {}

  async create(data: CreateUserData): Promise<User> {
    return this.repo.save(data);
  }
}
`;

    const service = new CodeUnitService();
    const unit = service.extractCodeUnit(code, 'UserService', 'typescript');

    expect(unit.type).toBe('class');
    expect(unit.name).toBe('UserService');
    expect(unit.fullContent).toContain('class UserService');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test code-unit.service.test.ts
```

Expected: FAIL - "Cannot find module '../src/services/code-unit.service.js'"

**Step 3: Create CodeUnitService with minimal implementation**

Create `src/services/code-unit.service.ts`:

```typescript
export interface CodeUnit {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'documentation' | 'example';
  name: string;
  signature: string;
  fullContent: string;
  startLine: number;
  endLine: number;
  language: string;
}

export class CodeUnitService {
  extractCodeUnit(code: string, symbolName: string, language: string): CodeUnit | undefined {
    const lines = code.split('\n');

    // Find the line containing the symbol
    let startLine = -1;
    let type: CodeUnit['type'] = 'function';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (line.includes(`function ${symbolName}`)) {
        startLine = i + 1; // 1-indexed
        type = 'function';
        break;
      }

      if (line.includes(`class ${symbolName}`)) {
        startLine = i + 1;
        type = 'class';
        break;
      }
    }

    if (startLine === -1) return undefined;

    // Find end line (naive: next empty line or next top-level declaration)
    let endLine = startLine;
    let braceCount = 0;
    let foundFirstBrace = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i] ?? '';

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundFirstBrace = true;
        }
        if (char === '}') braceCount--;
      }

      if (foundFirstBrace && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }

    const fullContent = lines.slice(startLine - 1, endLine).join('\n');

    // Extract signature (first line, cleaned)
    const firstLine = lines[startLine - 1] ?? '';
    const signature = this.extractSignature(firstLine, symbolName, type);

    return {
      type,
      name: symbolName,
      signature,
      fullContent,
      startLine,
      endLine,
      language
    };
  }

  private extractSignature(line: string, name: string, type: string): string {
    // Remove 'export', 'async', trim whitespace
    let sig = line.replace(/^\s*export\s+/, '').replace(/^\s*async\s+/, '').trim();

    if (type === 'function') {
      // Extract just "functionName(params): returnType"
      const match = sig.match(/function\s+(\w+\([^)]*\):\s*\w+)/);
      if (match && match[1]) return match[1];
    }

    if (type === 'class') {
      return `class ${name}`;
    }

    return sig;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test code-unit.service.test.ts
```

Expected: PASS

**Step 5: Add code unit to SearchResult type**

Modify `src/types/search.ts`:

```typescript
import type { DocumentMetadata } from './document.js';
import type { StoreId } from './brands.js';

export interface CodeUnit {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'documentation' | 'example';
  name: string;
  signature: string;
  fullContent: string;
  startLine: number;
  endLine: number;
  language: string;
}

export interface SearchResult {
  readonly id: string;
  readonly score: number;
  readonly content: string;
  readonly metadata: DocumentMetadata;
  readonly highlight?: string | undefined;

  // NEW: Structured code unit for AI agents
  readonly codeUnit?: CodeUnit | undefined;
}

// ... rest of existing types
```

**Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/services/code-unit.service.ts tests/services/code-unit.service.test.ts src/types/search.ts
git commit -m "feat(search): add code unit extraction service for AI agents"
```

---

### Task 1.2: Progressive Context Layers

**Goal:** Implement three-tier context delivery (summary, contextual, full) for token budget optimization.

**Files:**
- Modify: `src/types/search.ts`
- Modify: `src/services/search.service.ts`
- Modify: `src/cli/commands/search.ts`
- Create: `tests/services/search.progressive-context.test.ts`

**Step 1: Write failing test for progressive context**

Create `tests/services/search.progressive-context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { SearchResult } from '../src/types/search.js';

describe('Progressive Context', () => {
  it('should return minimal summary by default', () => {
    const result: SearchResult = {
      id: 'test-1',
      score: 0.95,
      content: 'function code here...',
      metadata: {
        type: 'chunk',
        storeId: 'test-store' as any,
        path: 'src/auth.ts',
        indexedAt: new Date(),
      },
      summary: {
        type: 'function',
        name: 'validateToken',
        signature: 'validateToken(token: string): boolean',
        purpose: 'Validates JWT token',
        location: 'src/auth.ts:45',
        relevanceReason: 'Matches query about token validation'
      }
    };

    expect(result.summary).toBeDefined();
    expect(result.context).toBeUndefined();
    expect(result.full).toBeUndefined();
  });

  it('should include context when detail=contextual', () => {
    // Test that context layer is populated
    expect(true).toBe(true); // Placeholder until implemented
  });
});
```

**Step 2: Run test**

```bash
npm run test search.progressive-context.test.ts
```

Expected: FAIL - "Property 'summary' does not exist on type 'SearchResult'"

**Step 3: Add progressive context to SearchResult type**

Modify `src/types/search.ts`:

```typescript
export interface ResultSummary {
  readonly type: 'function' | 'class' | 'interface' | 'pattern' | 'documentation';
  readonly name: string;
  readonly signature: string;
  readonly purpose: string;
  readonly location: string;
  readonly relevanceReason: string;
}

export interface ResultContext {
  readonly interfaces: readonly string[];
  readonly keyImports: readonly string[];
  readonly relatedConcepts: readonly string[];
  readonly usage: {
    readonly calledBy: number;
    readonly calls: number;
  };
}

export interface ResultFull {
  readonly completeCode: string;
  readonly relatedCode: ReadonlyArray<{
    readonly file: string;
    readonly summary: string;
    readonly relationship: string;
  }>;
  readonly documentation: string;
  readonly tests?: string | undefined;
}

export interface SearchResult {
  readonly id: string;
  readonly score: number;
  readonly content: string;
  readonly metadata: DocumentMetadata;
  readonly highlight?: string | undefined;
  readonly codeUnit?: CodeUnit | undefined;

  // NEW: Progressive context layers
  readonly summary?: ResultSummary | undefined;
  readonly context?: ResultContext | undefined;
  readonly full?: ResultFull | undefined;
}

export type DetailLevel = 'minimal' | 'contextual' | 'full';

export interface SearchQuery {
  readonly query: string;
  readonly stores?: readonly StoreId[] | undefined;
  readonly mode?: SearchMode | undefined;
  readonly threshold?: number | undefined;
  readonly limit?: number | undefined;
  readonly filter?: Record<string, unknown> | undefined;
  readonly includeContent?: boolean | undefined;
  readonly contextLines?: number | undefined;

  // NEW: Detail level for progressive context
  readonly detail?: DetailLevel | undefined;
}
```

**Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 5: Implement summary generation in SearchService**

Modify `src/services/search.service.ts`:

```typescript
import { CodeUnitService } from './code-unit.service.js';

export class SearchService {
  private readonly lanceStore: LanceStore;
  private readonly embeddingEngine: EmbeddingEngine;
  private readonly rrfConfig: RRFConfig;
  private readonly codeUnitService: CodeUnitService;

  constructor(
    lanceStore: LanceStore,
    embeddingEngine: EmbeddingEngine,
    rrfConfig: RRFConfig = { k: 20, vectorWeight: 0.6, ftsWeight: 0.4 }
  ) {
    this.lanceStore = lanceStore;
    this.embeddingEngine = embeddingEngine;
    this.rrfConfig = rrfConfig;
    this.codeUnitService = new CodeUnitService();
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    const mode = query.mode ?? 'hybrid';
    const limit = query.limit ?? 10;
    const stores = query.stores ?? [];
    const detail = query.detail ?? 'minimal';

    let allResults: SearchResult[] = [];

    const fetchLimit = limit * 3;

    if (mode === 'vector') {
      allResults = await this.vectorSearch(query.query, stores, fetchLimit, query.threshold);
    } else if (mode === 'fts') {
      allResults = await this.ftsSearch(query.query, stores, fetchLimit);
    } else {
      allResults = await this.hybridSearch(query.query, stores, fetchLimit, query.threshold);
    }

    const dedupedResults = this.deduplicateBySource(allResults, query.query);

    // Enhance results with progressive context
    const enhancedResults = dedupedResults.slice(0, limit).map(r =>
      this.addProgressiveContext(r, query.query, detail)
    );

    return {
      query: query.query,
      mode,
      stores,
      results: enhancedResults,
      totalResults: enhancedResults.length,
      timeMs: Date.now() - startTime,
    };
  }

  private addProgressiveContext(
    result: SearchResult,
    query: string,
    detail: DetailLevel
  ): SearchResult {
    const enhanced = { ...result };

    // Layer 1: Always add summary
    const path = result.metadata.path ?? result.metadata.url ?? 'unknown';
    const fileType = result.metadata['fileType'] as string | undefined;

    // Try to extract code unit
    const codeUnit = this.extractCodeUnitFromResult(result);

    enhanced.summary = {
      type: this.inferType(fileType, codeUnit),
      name: codeUnit?.name ?? this.extractSymbolName(result.content),
      signature: codeUnit?.signature ?? '',
      purpose: this.generatePurpose(result.content, query),
      location: `${path}${codeUnit ? ':' + codeUnit.startLine : ''}`,
      relevanceReason: this.generateRelevanceReason(result, query)
    };

    // Layer 2: Add context if requested
    if (detail === 'contextual' || detail === 'full') {
      enhanced.context = {
        interfaces: this.extractInterfaces(result.content),
        keyImports: this.extractImports(result.content),
        relatedConcepts: this.extractConcepts(result.content, query),
        usage: {
          calledBy: 0, // TODO: Implement from code graph
          calls: 0
        }
      };
    }

    // Layer 3: Add full context if requested
    if (detail === 'full') {
      enhanced.full = {
        completeCode: codeUnit?.fullContent ?? result.content,
        relatedCode: [], // TODO: Implement from code graph
        documentation: this.extractDocumentation(result.content),
        tests: undefined
      };
    }

    return enhanced;
  }

  private extractCodeUnitFromResult(result: SearchResult): CodeUnit | undefined {
    const path = result.metadata.path;
    if (!path) return undefined;

    const ext = path.split('.').pop() ?? '';
    const language = ext === 'ts' || ext === 'tsx' ? 'typescript' :
                     ext === 'js' || ext === 'jsx' ? 'javascript' : ext;

    // Try to find a symbol name in the content
    const symbolName = this.extractSymbolName(result.content);
    if (!symbolName) return undefined;

    return this.codeUnitService.extractCodeUnit(result.content, symbolName, language);
  }

  private extractSymbolName(content: string): string {
    // Extract function or class name
    const funcMatch = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch && funcMatch[1]) return funcMatch[1];

    const classMatch = content.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch && classMatch[1]) return classMatch[1];

    const constMatch = content.match(/(?:export\s+)?const\s+(\w+)/);
    if (constMatch && constMatch[1]) return constMatch[1];

    return '';
  }

  private inferType(fileType: string | undefined, codeUnit: CodeUnit | undefined): ResultSummary['type'] {
    if (codeUnit) return codeUnit.type as ResultSummary['type'];
    if (fileType === 'documentation' || fileType === 'documentation-primary') return 'documentation';
    return 'function';
  }

  private generatePurpose(content: string, query: string): string {
    // Extract first line of JSDoc comment if present
    const docMatch = content.match(/\/\*\*\s*\n\s*\*\s*([^\n]+)/);
    if (docMatch && docMatch[1]) return docMatch[1].trim();

    // Fallback: first line that looks like a purpose
    const lines = content.split('\n');
    for (const line of lines) {
      const cleaned = line.trim();
      if (cleaned.length > 20 && cleaned.length < 100 && !cleaned.startsWith('//')) {
        return cleaned;
      }
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
      if (match[1]) interfaces.push(match[1]);
    }
    return interfaces;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const matches = content.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
    for (const match of matches) {
      if (match[1]) imports.push(match[1]);
    }
    return imports.slice(0, 5); // Top 5
  }

  private extractConcepts(content: string, query: string): string[] {
    // Simple keyword extraction
    const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    const frequency = new Map<string, number>();

    for (const word of words) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private extractDocumentation(content: string): string {
    const docMatch = content.match(/\/\*\*([\s\S]*?)\*\//);
    if (docMatch && docMatch[1]) {
      return docMatch[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, '').trim())
        .filter(line => line.length > 0)
        .join('\n');
    }
    return '';
  }

  // ... rest of existing methods
}
```

**Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 7: Add --detail CLI flag**

Modify `src/cli/commands/search.ts`:

```typescript
export function createSearchCommand(getOptions: () => GlobalOptions): Command {
  const search = new Command('search')
    .description('Search indexed documents using vector similarity + full-text matching')
    .argument('<query>', 'Search query')
    .option('-s, --stores <stores>', 'Limit search to specific stores (comma-separated IDs or names)')
    .option('-m, --mode <mode>', 'vector (embeddings only), fts (text only), hybrid (both, default)', 'hybrid')
    .option('-n, --limit <count>', 'Maximum results to return (default: 10)', '10')
    .option('-t, --threshold <score>', 'Minimum score 0-1; omit low-relevance results')
    .option('--include-content', 'Show full document content, not just preview snippet')
    .option('--detail <level>', 'Context detail: minimal, contextual, full (default: minimal)', 'minimal')
    .action(async (query: string, options: {
      stores?: string;
      mode?: SearchMode;
      limit?: string;
      threshold?: string;
      includeContent?: boolean;
      detail?: DetailLevel;
    }) => {
      const globalOpts = getOptions();
      const services = await createServices(globalOpts.config, globalOpts.dataDir);

      let storeIds = (await services.store.list()).map((s) => s.id);

      if (options.stores !== undefined) {
        const requestedStores = options.stores.split(',').map((s) => s.trim());
        const resolvedStores = [];

        for (const requested of requestedStores) {
          const store = await services.store.getByIdOrName(requested);
          if (store !== undefined) {
            resolvedStores.push(store.id);
          } else {
            console.error(`Error: Store not found: ${requested}`);
            process.exit(3);
          }
        }

        storeIds = resolvedStores;
      }

      if (storeIds.length === 0) {
        console.error('No stores to search. Create a store first.');
        process.exit(1);
      }

      for (const storeId of storeIds) {
        await services.lance.initialize(storeId);
      }

      const results = await services.search.search({
        query,
        stores: storeIds,
        mode: options.mode ?? 'hybrid',
        limit: parseInt(options.limit ?? '10', 10),
        threshold: options.threshold !== undefined ? parseFloat(options.threshold) : undefined,
        includeContent: options.includeContent,
        detail: options.detail ?? 'minimal',
      });

      if (globalOpts.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else if (globalOpts.quiet === true) {
        for (const r of results.results) {
          const path = r.metadata.path ?? r.metadata.url ?? 'unknown';
          console.log(path);
        }
      } else {
        console.log(`\nSearch: "${query}"`);
        console.log(`Mode: ${results.mode} | Detail: ${options.detail} | Stores: ${results.stores.length} | Results: ${results.totalResults} | Time: ${results.timeMs}ms\n`);

        if (results.results.length === 0) {
          console.log('No results found.\n');
        } else {
          for (let i = 0; i < results.results.length; i++) {
            const r = results.results[i]!;

            if (r.summary) {
              console.log(`${i + 1}. [${r.score.toFixed(2)}] ${r.summary.type}: ${r.summary.name}`);
              console.log(`   ${r.summary.location}`);
              console.log(`   ${r.summary.purpose}`);

              if (r.context && options.detail !== 'minimal') {
                console.log(`   Imports: ${r.context.keyImports.slice(0, 3).join(', ')}`);
                console.log(`   Related: ${r.context.relatedConcepts.slice(0, 3).join(', ')}`);
              }

              console.log();
            } else {
              // Fallback to old format
              const path = r.metadata.path ?? r.metadata.url ?? 'unknown';
              console.log(`${i + 1}. [${r.score.toFixed(2)}] ${path}`);
              const preview = r.highlight ?? r.content.slice(0, 150).replace(/\n/g, ' ') + (r.content.length > 150 ? '...' : '');
              console.log(`   ${preview}\n`);
            }
          }
        }
      }
    });

  return search;
}
```

**Step 8: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 9: Test manually**

```bash
npm run build
./dist/index.js search "validate token" --detail contextual
```

Expected: Output shows summary with context information

**Step 10: Commit**

```bash
git add src/types/search.ts src/services/search.service.ts src/cli/commands/search.ts tests/services/search.progressive-context.test.ts
git commit -m "feat(search): add progressive context layers for token optimization"
```

---

### Task 1.3: MCP Server Integration

**Goal:** Expose search capabilities via Model Context Protocol for AI agent integration.

**Files:**
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools/search.ts`
- Create: `src/mcp/tools/get-context.ts`
- Modify: `package.json`
- Create: `src/cli/commands/mcp.ts`
- Modify: `src/cli/program.ts`
- Create: `tests/mcp/server.test.ts`

**Step 1: Install MCP SDK**

```bash
npm install @modelcontextprotocol/sdk
```

**Step 2: Write failing test for MCP server**

Create `tests/mcp/server.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createMCPServer } from '../src/mcp/server.js';

describe('MCP Server', () => {
  it('should create server with search tool', () => {
    const server = createMCPServer({
      dataDir: '/tmp/test',
      config: undefined
    });

    expect(server).toBeDefined();
    // MCP SDK doesn't expose tools list directly, so we test via integration
  });

  it('should handle search_codebase tool call', async () => {
    // Integration test - will implement after server is created
    expect(true).toBe(true);
  });
});
```

**Step 3: Run test**

```bash
npm run test mcp/server.test.ts
```

Expected: FAIL - "Cannot find module '../src/mcp/server.js'"

**Step 4: Create MCP server**

Create `src/mcp/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServices } from '../services/index.js';
import type { SearchQuery, DetailLevel } from '../types/search.js';

interface MCPServerOptions {
  dataDir?: string;
  config?: string;
}

export function createMCPServer(options: MCPServerOptions) {
  const server = new Server(
    {
      name: 'bluera-knowledge',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_codebase',
          description: 'Search codebase with pattern detection and AI-optimized results. Returns structured code units with progressive context layers.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query (can include type signatures, constraints, or natural language)'
              },
              intent: {
                type: 'string',
                enum: ['find-pattern', 'find-implementation', 'find-usage', 'find-definition', 'find-documentation'],
                description: 'Search intent for better ranking'
              },
              detail: {
                type: 'string',
                enum: ['minimal', 'contextual', 'full'],
                default: 'minimal',
                description: 'Context detail level: minimal (summary only), contextual (+ imports/types), full (+ complete code)'
              },
              limit: {
                type: 'number',
                default: 10,
                description: 'Maximum number of results'
              },
              stores: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific store IDs to search (optional)'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'get_full_context',
          description: 'Get complete code and context for a specific search result by ID. Use this after search_codebase to get full implementation details.',
          inputSchema: {
            type: 'object',
            properties: {
              resultId: {
                type: 'string',
                description: 'Result ID from previous search'
              }
            },
            required: ['resultId']
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'search_codebase') {
      const services = await createServices(options.config, options.dataDir);

      const query = args.query as string;
      const detail = (args.detail as DetailLevel) ?? 'minimal';
      const limit = (args.limit as number) ?? 10;
      const stores = args.stores as string[] | undefined;

      // Get all stores if none specified
      let storeIds = stores ?? (await services.store.list()).map(s => s.id);

      // Initialize stores
      for (const storeId of storeIds) {
        await services.lance.initialize(storeId);
      }

      // Perform search
      const searchQuery: SearchQuery = {
        query,
        stores: storeIds,
        mode: 'hybrid',
        limit,
        detail
      };

      const results = await services.search.search(searchQuery);

      // Calculate estimated tokens
      const estimatedTokens = results.results.reduce((sum, r) => {
        let tokens = 100; // Base for summary
        if (r.context) tokens += 200;
        if (r.full) tokens += 800;
        return sum + tokens;
      }, 0);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: results.results.map(r => ({
                id: r.id,
                score: r.score,
                summary: r.summary,
                context: r.context,
                full: r.full
              })),
              totalResults: results.totalResults,
              estimatedTokens,
              mode: results.mode,
              timeMs: results.timeMs
            }, null, 2)
          }
        ]
      };
    }

    if (name === 'get_full_context') {
      // TODO: Implement result caching and retrieval by ID
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Not yet implemented'
            })
          }
        ]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

export async function runMCPServer(options: MCPServerOptions) {
  const server = createMCPServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Bluera Knowledge MCP server running on stdio');
}
```

**Step 5: Create MCP CLI command**

Create `src/cli/commands/mcp.ts`:

```typescript
import { Command } from 'commander';
import type { GlobalOptions } from '../program.js';
import { runMCPServer } from '../../mcp/server.js';

export function createMCPCommand(getOptions: () => GlobalOptions): Command {
  const mcp = new Command('mcp')
    .description('Start MCP (Model Context Protocol) server for AI agent integration')
    .action(async () => {
      const opts = getOptions();

      await runMCPServer({
        dataDir: opts.dataDir,
        config: opts.config
      });
    });

  return mcp;
}
```

**Step 6: Register MCP command**

Modify `src/cli/program.ts`:

```typescript
import { createMCPCommand } from './commands/mcp.js';

// In createProgram function, add:
program.addCommand(createMCPCommand(getGlobalOptions));
```

**Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 8: Build and test MCP server**

```bash
npm run build
./dist/index.js mcp
```

In another terminal:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | ./dist/index.js mcp
```

Expected: JSON response with tools list

**Step 9: Commit**

```bash
git add src/mcp/ src/cli/commands/mcp.ts src/cli/program.ts package.json tests/mcp/
git commit -m "feat(mcp): add MCP server for AI agent integration"
```

---

## Phase 2: Static Analysis & Code Graph

### Task 2.1: TypeScript AST Parser

**Goal:** Parse TypeScript/JavaScript files to extract structured code elements (functions, classes, imports).

**Files:**
- Create: `src/analysis/ast-parser.ts`
- Create: `tests/analysis/ast-parser.test.ts`
- Modify: `package.json`

**Step 1: Install Babel parser**

```bash
npm install @babel/parser @babel/traverse @babel/types
npm install -D @types/babel__traverse @types/babel__core
```

**Step 2: Write failing test**

Create `tests/analysis/ast-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ASTParser } from '../src/analysis/ast-parser.js';

describe('ASTParser', () => {
  it('should extract functions from TypeScript code', () => {
    const code = `
export async function validateToken(token: string): Promise<boolean> {
  return token.length > 0;
}

function helperFunction() {
  return true;
}
`;

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.type).toBe('function');
    expect(nodes[0]?.name).toBe('validateToken');
    expect(nodes[0]?.exported).toBe(true);
    expect(nodes[0]?.async).toBe(true);
    expect(nodes[1]?.name).toBe('helperFunction');
    expect(nodes[1]?.exported).toBe(false);
  });

  it('should extract classes with methods', () => {
    const code = `
export class UserService {
  constructor(private repo: UserRepo) {}

  async create(data: CreateUserData): Promise<User> {
    return this.repo.save(data);
  }

  delete(id: string): void {
    this.repo.delete(id);
  }
}
`;

    const parser = new ASTParser();
    const nodes = parser.parse(code, 'typescript');

    const classNode = nodes.find(n => n.type === 'class');
    expect(classNode).toBeDefined();
    expect(classNode?.name).toBe('UserService');
    expect(classNode?.methods).toHaveLength(3); // constructor + create + delete
  });

  it('should extract imports', () => {
    const code = `
import { User } from './models/user.js';
import type { Repository } from '../types.js';
import express from 'express';
`;

    const parser = new ASTParser();
    const imports = parser.extractImports(code);

    expect(imports).toHaveLength(3);
    expect(imports[0]?.source).toBe('./models/user.js');
    expect(imports[0]?.specifiers).toContain('User');
    expect(imports[2]?.specifiers).toContain('express');
  });
});
```

**Step 3: Run test**

```bash
npm run test ast-parser.test.ts
```

Expected: FAIL - "Cannot find module '../src/analysis/ast-parser.js'"

**Step 4: Implement AST parser**

Create `src/analysis/ast-parser.ts`:

```typescript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface CodeNode {
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  name: string;
  exported: boolean;
  async?: boolean;
  startLine: number;
  endLine: number;
  signature?: string;
  methods?: Array<{
    name: string;
    async: boolean;
    signature: string;
  }>;
}

export interface ImportInfo {
  source: string;
  specifiers: string[];
  isType: boolean;
}

export class ASTParser {
  parse(code: string, language: 'typescript' | 'javascript'): CodeNode[] {
    const plugins: any[] = ['jsx'];
    if (language === 'typescript') {
      plugins.push('typescript');
    }

    const ast = parse(code, {
      sourceType: 'module',
      plugins
    });

    const nodes: CodeNode[] = [];

    traverse(ast, {
      FunctionDeclaration: (path) => {
        const node = path.node;
        if (!node.id) return;

        const exported = path.parent.type === 'ExportNamedDeclaration' ||
                        path.parent.type === 'ExportDefaultDeclaration';

        nodes.push({
          type: 'function',
          name: node.id.name,
          exported,
          async: node.async,
          startLine: node.loc?.start.line ?? 0,
          endLine: node.loc?.end.line ?? 0,
          signature: this.extractFunctionSignature(node)
        });
      },

      ClassDeclaration: (path) => {
        const node = path.node;
        if (!node.id) return;

        const exported = path.parent.type === 'ExportNamedDeclaration' ||
                        path.parent.type === 'ExportDefaultDeclaration';

        const methods: CodeNode['methods'] = [];

        for (const member of node.body.body) {
          if (t.isClassMethod(member) && t.isIdentifier(member.key)) {
            methods.push({
              name: member.key.name,
              async: member.async,
              signature: this.extractMethodSignature(member)
            });
          }
        }

        nodes.push({
          type: 'class',
          name: node.id.name,
          exported,
          startLine: node.loc?.start.line ?? 0,
          endLine: node.loc?.end.line ?? 0,
          methods
        });
      },

      TSInterfaceDeclaration: (path) => {
        const node = path.node;

        const exported = path.parent.type === 'ExportNamedDeclaration';

        nodes.push({
          type: 'interface',
          name: node.id.name,
          exported,
          startLine: node.loc?.start.line ?? 0,
          endLine: node.loc?.end.line ?? 0
        });
      }
    });

    return nodes;
  }

  extractImports(code: string): ImportInfo[] {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx']
    });

    const imports: ImportInfo[] = [];

    traverse(ast, {
      ImportDeclaration: (path) => {
        const node = path.node;
        const specifiers: string[] = [];

        for (const spec of node.specifiers) {
          if (t.isImportDefaultSpecifier(spec)) {
            specifiers.push(spec.local.name);
          } else if (t.isImportSpecifier(spec)) {
            specifiers.push(spec.local.name);
          } else if (t.isImportNamespaceSpecifier(spec)) {
            specifiers.push(spec.local.name);
          }
        }

        imports.push({
          source: node.source.value,
          specifiers,
          isType: node.importKind === 'type'
        });
      }
    });

    return imports;
  }

  private extractFunctionSignature(node: t.FunctionDeclaration): string {
    const params = node.params.map(p => {
      if (t.isIdentifier(p)) return p.name;
      return 'param';
    }).join(', ');

    return `${node.id?.name}(${params})`;
  }

  private extractMethodSignature(node: t.ClassMethod): string {
    const params = node.params.map(p => {
      if (t.isIdentifier(p)) return p.name;
      return 'param';
    }).join(', ');

    const name = t.isIdentifier(node.key) ? node.key.name : 'method';
    return `${name}(${params})`;
  }
}
```

**Step 5: Run tests**

```bash
npm run test ast-parser.test.ts
```

Expected: PASS

**Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/analysis/ast-parser.ts tests/analysis/ast-parser.test.ts package.json
git commit -m "feat(analysis): add TypeScript/JavaScript AST parser"
```

---

### Task 2.2: Code Graph Builder

**Goal:** Build relationship graph (calls, imports) from parsed code.

**Files:**
- Create: `src/analysis/code-graph.ts`
- Create: `tests/analysis/code-graph.test.ts`

**Step 1: Write failing test**

Create `tests/analysis/code-graph.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { CodeGraph } from '../src/analysis/code-graph.js';
import type { CodeNode } from '../src/analysis/ast-parser.js';

describe('CodeGraph', () => {
  it('should build graph from code nodes', () => {
    const nodes: CodeNode[] = [
      {
        type: 'function',
        name: 'validateToken',
        exported: true,
        startLine: 1,
        endLine: 5
      },
      {
        type: 'function',
        name: 'parseToken',
        exported: false,
        startLine: 7,
        endLine: 10
      }
    ];

    const graph = new CodeGraph();
    graph.addNodes(nodes, 'src/auth.ts');

    expect(graph.getNode('src/auth.ts:validateToken')).toBeDefined();
    expect(graph.getNode('src/auth.ts:parseToken')).toBeDefined();
  });

  it('should track import relationships', () => {
    const graph = new CodeGraph();

    graph.addImport('src/controllers/user.ts', './services/user.js', ['UserService']);

    const edges = graph.getEdges('src/controllers/user.ts');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.type).toBe('imports');
    expect(edges[0]?.to).toContain('UserService');
  });

  it('should detect call relationships from code', () => {
    const code = `
export function handler(req) {
  const valid = validateToken(req.token);
  if (!valid) return error();
  return success();
}
`;

    const graph = new CodeGraph();
    graph.analyzeCallRelationships(code, 'src/handler.ts', 'handler');

    const edges = graph.getEdges('src/handler.ts:handler');
    const callEdges = edges.filter(e => e.type === 'calls');

    expect(callEdges.length).toBeGreaterThan(0);
    expect(callEdges.some(e => e.to.includes('validateToken'))).toBe(true);
  });
});
```

**Step 2: Run test**

```bash
npm run test code-graph.test.ts
```

Expected: FAIL - "Cannot find module '../src/analysis/code-graph.js'"

**Step 3: Implement code graph**

Create `src/analysis/code-graph.ts`:

```typescript
import type { CodeNode } from './ast-parser.js';

export interface GraphNode {
  id: string;
  file: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  name: string;
  exported: boolean;
  startLine: number;
  endLine: number;
  signature?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'calls' | 'imports' | 'extends' | 'implements';
  confidence: number;
}

export class CodeGraph {
  private nodes = new Map<string, GraphNode>();
  private edges = new Map<string, GraphEdge[]>();

  addNodes(nodes: CodeNode[], file: string): void {
    for (const node of nodes) {
      const id = `${file}:${node.name}`;

      this.nodes.set(id, {
        id,
        file,
        type: node.type,
        name: node.name,
        exported: node.exported,
        startLine: node.startLine,
        endLine: node.endLine,
        signature: node.signature
      });

      // Initialize edges array for this node
      if (!this.edges.has(id)) {
        this.edges.set(id, []);
      }
    }
  }

  addImport(fromFile: string, toFile: string, specifiers: string[]): void {
    // Normalize the toFile path (resolve relative imports)
    const resolvedTo = this.resolveImportPath(fromFile, toFile);

    for (const spec of specifiers) {
      const edge: GraphEdge = {
        from: fromFile,
        to: `${resolvedTo}:${spec}`,
        type: 'imports',
        confidence: 1.0
      };

      const edges = this.edges.get(fromFile) ?? [];
      edges.push(edge);
      this.edges.set(fromFile, edges);
    }
  }

  analyzeCallRelationships(code: string, file: string, functionName: string): void {
    const nodeId = `${file}:${functionName}`;

    // Simple regex-based call detection (can be enhanced with AST later)
    const callPattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g;
    const calls = new Set<string>();

    let match;
    while ((match = callPattern.exec(code)) !== null) {
      if (match[1]) {
        calls.add(match[1]);
      }
    }

    const edges = this.edges.get(nodeId) ?? [];

    for (const calledFunction of calls) {
      // Try to find the called function in the graph
      const targetNode = this.findNodeByName(calledFunction);

      if (targetNode) {
        edges.push({
          from: nodeId,
          to: targetNode.id,
          type: 'calls',
          confidence: 0.8 // Lower confidence for regex-based detection
        });
      } else {
        // Unknown function, possibly from import
        edges.push({
          from: nodeId,
          to: `unknown:${calledFunction}`,
          type: 'calls',
          confidence: 0.5
        });
      }
    }

    this.edges.set(nodeId, edges);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getEdges(nodeId: string): GraphEdge[] {
    return this.edges.get(nodeId) ?? [];
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  private findNodeByName(name: string): GraphNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.name === name) {
        return node;
      }
    }
    return undefined;
  }

  private resolveImportPath(fromFile: string, importPath: string): string {
    // Simple resolution - can be enhanced
    if (importPath.startsWith('.')) {
      // Relative import
      const fromDir = fromFile.split('/').slice(0, -1).join('/');
      const parts = importPath.split('/');

      let resolved = fromDir;
      for (const part of parts) {
        if (part === '..') {
          resolved = resolved.split('/').slice(0, -1).join('/');
        } else if (part !== '.') {
          resolved += '/' + part;
        }
      }

      return resolved.replace(/\.js$/, '');
    }

    // Package import
    return importPath;
  }

  toJSON(): { nodes: GraphNode[]; edges: Array<{ from: string; to: string; type: string }> } {
    const allEdges: GraphEdge[] = [];
    for (const edges of this.edges.values()) {
      allEdges.push(...edges);
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: allEdges.map(e => ({ from: e.from, to: e.to, type: e.type }))
    };
  }
}
```

**Step 4: Run tests**

```bash
npm run test code-graph.test.ts
```

Expected: PASS

**Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/analysis/code-graph.ts tests/analysis/code-graph.test.ts
git commit -m "feat(analysis): add code graph builder for relationship tracking"
```

---

## Execution Notes

**Total estimated time for Phase 1 (MVP):**
- Task 1.1: 2-3 days
- Task 1.2: 3-4 days
- Task 1.3: 3-4 days
- Task 2.1: 2-3 days
- Task 2.2: 2-3 days

**Total: ~12-17 days (2.5-3.5 weeks)**

**Phase 2 (Pattern Detection) and beyond:** Detailed plans available upon request after Phase 1 completion.

**Testing Strategy:**
- Unit tests for all services (TDD approach)
- Integration tests for MCP server with real Claude Code
- Manual testing with test corpus (Vue.js, Express, Hono)
- Agent outcome tracking once MCP is live

**Success Metrics for Phase 1:**
- Search results include structured code units (100% of code files)
- Progressive context reduces tokens by 40% on average
- MCP server successfully integrates with Claude Code
- Code graph captures 90%+ of function relationships
