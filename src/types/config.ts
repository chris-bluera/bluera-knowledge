export interface EmbeddingConfig {
  readonly model: string;
  readonly batchSize: number;
  readonly dimensions: number;
}

export interface IndexingConfig {
  readonly concurrency: number;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly ignorePatterns: readonly string[];
}

export interface SearchConfig {
  readonly defaultMode: 'vector' | 'fts' | 'hybrid';
  readonly defaultLimit: number;
  readonly minScore: number;
  readonly rrf: {
    readonly k: number;
    readonly vectorWeight: number;
    readonly ftsWeight: number;
  };
}

export interface CrawlConfig {
  readonly userAgent: string;
  readonly timeout: number;
  readonly maxConcurrency: number;
}

export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

export interface AppConfig {
  readonly version: number;
  readonly dataDir: string;
  readonly embedding: EmbeddingConfig;
  readonly indexing: IndexingConfig;
  readonly search: SearchConfig;
  readonly crawl: CrawlConfig;
  readonly server: ServerConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  dataDir: '~/.bluera/claude-knowledge-base/data',
  embedding: {
    model: 'Xenova/all-MiniLM-L6-v2',
    batchSize: 32,
    dimensions: 384,
  },
  indexing: {
    concurrency: 4,
    chunkSize: 1000,
    chunkOverlap: 150,
    ignorePatterns: ['node_modules/**', '.git/**', '*.min.js', '*.map'],
  },
  search: {
    defaultMode: 'hybrid',
    defaultLimit: 10,
    minScore: 0.5,
    rrf: {
      k: 40,
      vectorWeight: 0.7,
      ftsWeight: 0.3,
    },
  },
  crawl: {
    userAgent: 'BlueraKnowledge/1.0',
    timeout: 30000,
    maxConcurrency: 3,
  },
  server: {
    port: 3847,
    host: '127.0.0.1',
  },
};
