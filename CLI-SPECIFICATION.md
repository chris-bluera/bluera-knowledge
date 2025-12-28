# Bluera Knowledge CLI - Technical Specification

## Executive Summary

A comprehensive CLI tool for managing knowledge stores with semantic search capabilities. Designed to provide full feature parity with the existing bkbVS Code extension, enabling headless operation, scriptability, and integration with CI/CD pipelines.

**Target Location**: `~/repos/bluera-studio-work/bluera-knowledge/`

---

## Architecture Decision: TypeScript with Python Bridge

**Recommendation**: TypeScript primary with Python subprocess bridge

**Rationale**:
1. The existing bkbmodule is 95% TypeScript
2. Python is only used for crawl4ai web crawling (single dependency)
3. Maintains codebase consistency with Bluera ecosystem
4. Enables code sharing with existing implementation
5. Python bridge pattern is already proven in the codebase

**Note**: The existing module does NOT use CrewAI - it uses Bluera's custom agent framework. The only Python dependency is crawl4ai for web content extraction.

---

## Design Principles

### 1. Unified Core Architecture (DRY)

Both CLI and HTTP API share the same underlying service layer. The architecture follows a strict separation:

```
┌────────────────────────────────────────────────────────────────┐
│                      Interface Layer                            │
├────────────────────────┬───────────────────────────────────────┤
│     CLI (commander)    │        HTTP API (hono)                │
│  - Argument parsing    │     - Request parsing                 │
│  - Output formatting   │     - Response serialization          │
│  - Progress display    │     - SSE streaming                   │
└────────────┬───────────┴───────────────────┬───────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│  - StoreService      (store CRUD operations)                   │
│  - IndexService      (indexing pipeline)                       │
│  - SearchService     (vector/fts/hybrid search)                │
│  - CrawlService      (web crawling via Python bridge)          │
├────────────────────────────────────────────────────────────────┤
│                      Data Layer                                 │
│  - LanceDB           (vector storage)                          │
│  - EmbeddingEngine   (Transformers.js)                         │
│  - ConfigManager     (configuration)                           │
└────────────────────────────────────────────────────────────────┘
```

**Key rules**:
- CLI commands call service methods directly
- HTTP routes call the same service methods
- No business logic in CLI or HTTP layer
- Services return typed Results, interfaces format for output

### 2. Strict Typing Requirements

**Absolute rules** (enforced by tsconfig and eslint):
- `noImplicitAny: true` - No implicit any types
- `strict: true` - All strict checks enabled
- Never use `any` - use `unknown` with type guards instead
- All function parameters and returns explicitly typed
- Use typed Records: `Record<StoreId, StoreConfig>` not `{}`
- Discriminated unions for result types
- Branded types for IDs: `type StoreId = string & { readonly brand: unique symbol }`

**Type patterns**:

```typescript
// Branded types for type-safe IDs
declare const StoreIdBrand: unique symbol;
type StoreId = string & { readonly [StoreIdBrand]: typeof StoreIdBrand };

declare const DocumentIdBrand: unique symbol;
type DocumentId = string & { readonly [DocumentIdBrand]: typeof DocumentIdBrand };

// Result types (no exceptions for expected errors)
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Typed Records
type StoreRegistry = Record<StoreId, Store>;
type DocumentIndex = Record<DocumentId, DocumentMetadata>;

// Discriminated unions for store types
type Store = FileStore | RepoStore | WebStore;

interface FileStore {
  type: 'file';
  id: StoreId;
  name: string;
  path: string;
  // ...
}

interface RepoStore {
  type: 'repo';
  id: StoreId;
  name: string;
  path: string;
  branch?: string;
  // ...
}

interface WebStore {
  type: 'web';
  id: StoreId;
  name: string;
  url: string;
  depth: number;
  // ...
}

// Type guards
function isFileStore(store: Store): store is FileStore {
  return store.type === 'file';
}
```

---

## Core Components

### 1. Vector Storage Layer (LanceDB)

```
┌─────────────────────────────────────────────────────────────┐
│                     LanceDB Store                           │
├─────────────────────────────────────────────────────────────┤
│  Table: documents                                           │
│  ├── id: string (unique)                                    │
│  ├── content: string                                        │
│  ├── vector: float32[384]  (all-MiniLM-L6-v2)              │
│  ├── metadata: {                                            │
│  │     path: string,                                        │
│  │     type: 'file' | 'chunk' | 'web',                     │
│  │     store_id: string,                                    │
│  │     indexed_at: timestamp,                               │
│  │     ...custom fields                                     │
│  │   }                                                      │
│  └── fts_content: string (full-text search index)          │
└─────────────────────────────────────────────────────────────┘
```

### 2. Embedding Engine (Transformers.js)

- Model: `Xenova/all-MiniLM-L6-v2`
- Dimensions: 384
- Runtime: ONNX via WASM (browser-compatible, Node.js compatible)
- Batch processing for efficiency

### 3. Store Types

| Type | Description | Source |
|------|-------------|--------|
| `file` | Single file or folder | File system |
| `repo` | Git repository (with .gitignore respect) | File system |
| `web` | Web pages/sites | crawl4ai (Python) |

### 4. Search Modes

| Mode | Algorithm | Use Case |
|------|-----------|----------|
| `vector` | Cosine similarity on embeddings | Semantic search |
| `fts` | Full-text search (BM25-like) | Keyword search |
| `hybrid` | Vector + FTS with RRF fusion | Best of both |

---

## CLI Command Structure

### Global Options

```bash
bkb[command] [options]

Global Options:
  --config, -c     Path to config file (default: ~/.bluera/knowledge.json)
  --data-dir, -d   Data directory (default: ~/.bluera/knowledge-data/)
  --format, -f     Output format: json | table | plain (default: table)
  --quiet, -q      Suppress non-essential output
  --verbose, -v    Enable verbose logging
  --help, -h       Show help
  --version        Show version
```

### Store Management Commands

```bash
# List all stores
bkbstore list [--type <type>] [--status <status>]

# Create a new store
bkbstore create <name> --type <file|repo|web> --source <path|url>
  --type         Store type (required)
  --source       Source path or URL (required)
  --description  Optional description
  --tags         Comma-separated tags

# Show store details
bkbstore info <store-id|name>

# Update store configuration
bkbstore update <store-id|name> [--name <new-name>] [--description <desc>]

# Delete a store
bkbstore delete <store-id|name> [--force]

# Get store statistics
bkbstore stats <store-id|name>
```

### Indexing Commands

```bash
# Index a store (full reindex)
bkbindex <store-id|name>
  --incremental    Only index changed files
  --force          Force reindex all files
  --concurrency    Number of parallel workers (default: 4)
  --progress       Show progress bar (default: true in TTY)

# Index status
bkbindex status <store-id|name>

# Cancel ongoing indexing
bkbindex cancel <store-id|name>

# Watch for changes and auto-index
bkbindex watch <store-id|name>
  --debounce       Debounce interval in ms (default: 1000)
```

### Search Commands

```bash
# Search across stores
bkbsearch <query>
  --stores, -s     Comma-separated store IDs/names (default: all)
  --mode           Search mode: vector | fts | hybrid (default: hybrid)
  --limit, -n      Max results (default: 10)
  --threshold      Minimum relevance score 0-1 (default: 0.5)
  --filter         Metadata filter expression (JSON)
  --include-content  Include full content in results

# Search with context (returns surrounding chunks)
bkbsearch <query> --context <lines>

# Interactive search mode
bkbsearch --interactive
```

### Web Crawling Commands

```bash
# Crawl a URL/site
bkbcrawl <url>
  --store          Target store ID/name
  --depth          Crawl depth (default: 1)
  --max-pages      Maximum pages to crawl (default: 50)
  --include        URL patterns to include (glob)
  --exclude        URL patterns to exclude (glob)
  --respect-robots Respect robots.txt (default: true)

# Check crawl status
bkbcrawl status

# Cancel ongoing crawl
bkbcrawl cancel
```

### Maintenance Commands

```bash
# Compact database (reclaim space)
bkbmaintenance compact

# Verify store integrity
bkbmaintenance verify <store-id|name>

# Export store to portable format
bkbexport <store-id|name> --output <path>
  --format         Export format: json | parquet | lance

# Import store from export
bkbimport <path> --name <store-name>

# Clear all data
bkbmaintenance reset --confirm
```

### Server Mode (for UI Integration)

```bash
# Start HTTP server for UI/API access
bkbserve
  --port, -p       Port number (default: 3847)
  --host           Host to bind (default: 127.0.0.1)
  --cors           Enable CORS (default: false)
```

---

## Interactive Features

### Progress Display

For long-running operations (indexing, crawling), display real-time progress:

```
Indexing store "my-project"...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% │ 1,234/1,234 files │ 00:02:34

✓ Indexed 1,234 files (45.2 MB)
✓ Generated 8,456 chunks
✓ Created 8,456 embeddings
```

### Table Output (Default)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Knowledge Stores                                                          │
├────────────┬──────────┬────────┬───────────────┬──────────┬──────────────┤
│ Name       │ Type     │ Status │ Documents     │ Size     │ Last Indexed │
├────────────┼──────────┼────────┼───────────────┼──────────┼──────────────┤
│ my-project │ file     │ ready  │ 1,234 (8.4K)  │ 45.2 MB  │ 2 hours ago  │
│ docs-site  │ web      │ ready  │ 156 (2.1K)    │ 8.7 MB   │ 1 day ago    │
│ api-repo   │ repo     │ syncing│ 892 (5.2K)    │ 32.1 MB  │ in progress  │
└────────────┴──────────┴────────┴───────────────┴──────────┴──────────────┘
```

### Search Results

```
Search: "how to configure authentication"
Mode: hybrid │ Stores: 3 │ Results: 10 │ Time: 45ms

 1. [0.92] docs-site/auth/configuration.md:12-45
    Configure authentication using the auth.config.ts file. The following
    options are available: providers, session, callbacks...

 2. [0.87] my-project/src/auth/README.md:1-30
    # Authentication Setup
    This module handles user authentication using OAuth 2.0...

 3. [0.81] api-repo/docs/API.md:156-180
    ## Authentication Endpoints
    POST /api/auth/login - Authenticate user with credentials...
```

---

## Configuration File

`~/.bluera/knowledge.json`:

```json
{
  "version": 1,
  "dataDir": "~/.bluera/knowledge-data",
  "embedding": {
    "model": "Xenova/all-MiniLM-L6-v2",
    "batchSize": 32,
    "dimensions": 384
  },
  "indexing": {
    "concurrency": 4,
    "chunkSize": 512,
    "chunkOverlap": 50,
    "ignorePatterns": [
      "node_modules/**",
      ".git/**",
      "*.min.js",
      "*.map"
    ]
  },
  "search": {
    "defaultMode": "hybrid",
    "defaultLimit": 10,
    "minScore": 0.5,
    "rrf": {
      "k": 60,
      "vectorWeight": 0.7,
      "ftsWeight": 0.3
    }
  },
  "crawl": {
    "userAgent": "BlueraKnowledge/1.0",
    "timeout": 30000,
    "maxConcurrency": 3
  },
  "server": {
    "port": 3847,
    "host": "127.0.0.1"
  }
}
```

---

## Data Directory Structure

```
~/.bluera/knowledge-data/
├── stores/
│   ├── <store-id>/
│   │   ├── lance/                 # LanceDB files
│   │   │   └── documents.lance/
│   │   ├── metadata.json          # Store configuration
│   │   └── index-state.json       # Indexing progress/state
│   └── ...
├── cache/
│   ├── embeddings/                # Cached embedding model
│   └── crawl/                     # Cached web crawl results
└── logs/
    └── knowledge.log
```

---

## API Server Endpoints (serve mode)

For UI integration, the serve mode exposes a REST API:

```
GET    /api/stores                    List all stores
POST   /api/stores                    Create store
GET    /api/stores/:id                Get store details
PATCH  /api/stores/:id                Update store
DELETE /api/stores/:id                Delete store
GET    /api/stores/:id/stats          Get store statistics

POST   /api/stores/:id/index          Start indexing
GET    /api/stores/:id/index/status   Get indexing status
DELETE /api/stores/:id/index          Cancel indexing
GET    /api/stores/:id/index/stream   SSE progress stream

POST   /api/search                    Execute search
GET    /api/search/suggestions        Get search suggestions

POST   /api/crawl                     Start web crawl
GET    /api/crawl/status              Get crawl status
DELETE /api/crawl                     Cancel crawl

GET    /health                        Health check
GET    /metrics                       Prometheus metrics
```

---

## Python Bridge (crawl4ai)

### Bridge Architecture

```
┌─────────────────────┐     spawn      ┌─────────────────────┐
│   TypeScript CLI    │ ──────────────▶│   Python Process    │
│                     │                 │   (crawl-worker.py) │
│  - stdin: JSON-RPC  │◀───────────────│                     │
│  - stdout: results  │    responses   │  - crawl4ai         │
│  - stderr: logs     │                │  - BeautifulSoup    │
└─────────────────────┘                └─────────────────────┘
```

### JSON-RPC Protocol

```typescript
// Request (TypeScript → Python)
interface CrawlRequest {
  jsonrpc: "2.0";
  id: string;
  method: "crawl" | "cancel" | "status";
  params: {
    url: string;
    depth?: number;
    maxPages?: number;
    include?: string[];
    exclude?: string[];
  };
}

// Response (Python → TypeScript)
interface CrawlResponse {
  jsonrpc: "2.0";
  id: string;
  result?: {
    pages: Array<{
      url: string;
      title: string;
      content: string;
      links: string[];
      crawledAt: string;
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

// Progress notification
interface CrawlProgress {
  jsonrpc: "2.0";
  method: "progress";
  params: {
    current: number;
    total: number;
    url: string;
    status: "crawling" | "extracting" | "done";
  };
}
```

---

## Implementation Plan

### Phase 1: Core Infrastructure
1. Project scaffolding (TypeScript, ESBuild, Node.js)
2. Configuration management
3. LanceDB integration
4. Embedding engine (Transformers.js)
5. Basic CLI framework (Commander.js or similar)

### Phase 2: Store Management
1. Store CRUD operations
2. File system scanning/watching
3. Document chunking
4. Indexing pipeline

### Phase 3: Search
1. Vector search implementation
2. Full-text search
3. Hybrid search with RRF
4. Result formatting

### Phase 4: Web Crawling
1. Python bridge implementation
2. crawl4ai integration
3. Progress streaming
4. URL normalization and deduplication

### Phase 5: Server Mode
1. HTTP server (Fastify or Hono)
2. REST API endpoints
3. SSE for progress
4. WebSocket for real-time updates

### Phase 6: Polish
1. Interactive mode
2. Shell completions
3. Man pages
4. Performance optimization

---

## File Structure

```
~/repos/bluera-studio-work/bluera-knowledge/
├── package.json
├── tsconfig.json                     # strict: true, noImplicitAny: true
├── tsup.config.ts                    # Build configuration
├── eslint.config.js                  # @typescript-eslint/no-explicit-any: error
├── README.md
├── src/
│   ├── index.ts                      # Entry point (CLI)
│   │
│   │── types/                        # Shared types (first - no deps)
│   │   ├── index.ts                  # Re-exports all types
│   │   ├── brands.ts                 # Branded types (StoreId, DocumentId)
│   │   ├── store.ts                  # Store discriminated union
│   │   ├── document.ts               # Document types
│   │   ├── search.ts                 # Search types
│   │   ├── result.ts                 # Result<T, E> type
│   │   └── config.ts                 # Config schema types
│   │
│   ├── services/                     # Business logic (shared by CLI & API)
│   │   ├── index.ts                  # ServiceContainer (DI)
│   │   ├── store.service.ts          # Store CRUD
│   │   ├── index.service.ts          # Indexing pipeline
│   │   ├── search.service.ts         # Search operations
│   │   ├── crawl.service.ts          # Web crawling
│   │   └── config.service.ts         # Configuration
│   │
│   ├── db/                           # Data layer
│   │   ├── lance.ts                  # LanceDB wrapper (typed)
│   │   ├── embeddings.ts             # Transformers.js wrapper
│   │   └── migrations.ts             # Schema migrations
│   │
│   ├── cli/                          # CLI interface layer
│   │   ├── index.ts                  # Commander setup
│   │   ├── commands/
│   │   │   ├── store.ts              # store list|create|info|update|delete
│   │   │   ├── index.ts              # index|status|cancel|watch
│   │   │   ├── search.ts             # search
│   │   │   ├── crawl.ts              # crawl|status|cancel
│   │   │   ├── serve.ts              # serve (starts HTTP server)
│   │   │   └── maintenance.ts        # compact|verify|export|import|reset
│   │   └── formatters/               # Output formatting (CLI-specific)
│   │       ├── table.ts              # Table output
│   │       ├── json.ts               # JSON output
│   │       └── progress.ts           # Progress bars (ora)
│   │
│   ├── server/                       # HTTP interface layer
│   │   ├── index.ts                  # Hono server setup
│   │   ├── routes/
│   │   │   ├── stores.ts             # /api/stores/*
│   │   │   ├── search.ts             # /api/search
│   │   │   └── crawl.ts              # /api/crawl
│   │   └── middleware/
│   │       ├── error.ts              # Error handling (typed)
│   │       └── validate.ts           # Request validation (zod)
│   │
│   └── crawl/                        # Python bridge
│       ├── bridge.ts                 # Subprocess manager (JSON-RPC)
│       └── worker.py                 # Python crawl worker
│
├── python/
│   ├── requirements.txt              # crawl4ai, beautifulsoup4
│   └── crawl_worker.py               # Stateless crawl worker
│
└── tests/
    ├── unit/
    │   ├── services/                 # Service tests
    │   └── types/                    # Type guard tests
    └── integration/
        ├── cli/                      # CLI integration tests
        └── api/                      # API integration tests
```

### Key Architecture Invariants

1. **Types are dependency-free**: `src/types/` has no imports from other src folders
2. **Services are interface-agnostic**: Services don't know about CLI or HTTP
3. **Same service instance**: Both CLI and server use same ServiceContainer
4. **Type guards co-located**: Each discriminated union has type guards in same file

---

## Dependencies

### TypeScript
- `commander` - CLI framework
- `@lancedb/lancedb` - Vector database
- `@xenova/transformers` - Embeddings
- `chokidar` - File watching
- `hono` - HTTP server (lightweight)
- `cli-table3` - Table output
- `ora` - Spinners
- `chalk` - Colors
- `inquirer` - Interactive prompts
- `zod` - Runtime validation (API requests)

### Python
- `crawl4ai` - Web crawling
- `beautifulsoup4` - HTML parsing

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    // STRICT MODE - ALL ENABLED
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,

    // ADDITIONAL STRICTNESS
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,

    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### eslint.config.js (excerpt)

```javascript
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
    },
  },
];
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Store not found |
| 4 | Index error |
| 5 | Search error |
| 6 | Crawl error |
| 7 | Configuration error |
| 130 | Interrupted (Ctrl+C) |

---

## Example Workflows

### Index a Local Project
```bash
# Create and index a file store (single file or folder)
bkbstore create my-project --type file --source ./my-project
bkbindex my-project

# Search the indexed content
bkbsearch "authentication flow"
```

### Monitor a Repository
```bash
# Create repo store (respects .gitignore)
bkbstore create api-docs --type repo --source ~/projects/api

# Watch for changes
bkbindex watch api-docs
```

### Build a Knowledge Base from Documentation Sites
```bash
# Crawl documentation
bkbstore create vue-docs --type web --source https://vuejs.org/guide/
bkbcrawl https://vuejs.org/guide/ --store vue-docs --depth 2

# Search across all stores
bkbsearch "composition API reactivity" --stores vue-docs
```

### Scripting/Automation
```bash
# JSON output for scripting
bkbsearch "error handling" --format json | jq '.results[0].path'

# Pipe search results
bkbsearch "TODO" --include-content --format plain | grep -n "FIXME"
```
