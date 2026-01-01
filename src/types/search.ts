import type { StoreId, DocumentId } from './brands.js';
import type { DocumentMetadata } from './document.js';

export type SearchMode = 'vector' | 'fts' | 'hybrid';

export interface CodeUnit {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'documentation' | 'example';
  name: string;
  signature: string;
  fullContent: string;
  startLine: number;
  endLine: number;
  language: string;
}

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

export type DetailLevel = 'minimal' | 'contextual' | 'full';

export interface SearchQuery {
  readonly query: string;
  readonly stores?: readonly StoreId[] | undefined;
  readonly mode?: SearchMode | undefined;
  readonly limit?: number | undefined;
  readonly threshold?: number | undefined;
  readonly filter?: Record<string, unknown> | undefined;
  readonly includeContent?: boolean | undefined;
  readonly contextLines?: number | undefined;

  // Detail level for progressive context
  readonly detail?: DetailLevel | undefined;
}

export interface SearchResult {
  readonly id: DocumentId;
  score: number;
  readonly content: string;
  readonly highlight?: string | undefined;
  readonly metadata: DocumentMetadata;

  // Structured code unit for AI agents
  readonly codeUnit?: CodeUnit | undefined;

  // Progressive context layers
  readonly summary?: ResultSummary | undefined;
  readonly context?: ResultContext | undefined;
  readonly full?: ResultFull | undefined;

  // Ranking attribution metadata for transparency
  readonly rankingMetadata?: {
    readonly vectorRank?: number;    // Position in vector results (1-based)
    readonly ftsRank?: number;       // Position in FTS results (1-based)
    readonly vectorRRF: number;      // Vector contribution to RRF score
    readonly ftsRRF: number;         // FTS contribution to RRF score
    readonly fileTypeBoost: number;  // File type multiplier applied
    readonly frameworkBoost: number; // Framework context multiplier
  } | undefined;
}

export interface SearchResponse {
  readonly query: string;
  readonly mode: SearchMode;
  readonly stores: readonly StoreId[];
  readonly results: readonly SearchResult[];
  readonly totalResults: number;
  readonly timeMs: number;
}
