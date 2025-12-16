import type { DocumentId, StoreId } from './brands.js';

export type DocumentType = 'file' | 'chunk' | 'web';

export interface DocumentMetadata {
  readonly path?: string;
  readonly url?: string;
  readonly type: DocumentType;
  readonly storeId: StoreId;
  readonly indexedAt: Date;
  readonly fileHash?: string;
  readonly chunkIndex?: number;
  readonly totalChunks?: number;
  readonly [key: string]: unknown;
}

export interface Document {
  readonly id: DocumentId;
  readonly content: string;
  readonly vector: readonly number[];
  readonly metadata: DocumentMetadata;
}

export interface DocumentChunk {
  readonly id: DocumentId;
  readonly content: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly metadata: DocumentMetadata;
}
