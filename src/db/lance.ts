import * as lancedb from '@lancedb/lancedb';
import { createDocumentId } from '../types/brands.js';
import type { StoreId, DocumentId } from '../types/brands.js';
import type { Document, DocumentMetadata } from '../types/document.js';
import type { Table, Connection } from '@lancedb/lancedb';

interface LanceDocument {
  id: string;
  content: string;
  vector: number[];
  metadata: string; // JSON serialized
  [key: string]: unknown;
}

interface SearchHit {
  id: string;
  content: string;
  metadata: string;
  _distance: number;
}

export class LanceStore {
  private connection: Connection | null = null;
  private readonly tables: Map<string, Table> = new Map();
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(storeId: StoreId): Promise<void> {
    this.connection ??= await lancedb.connect(this.dataDir);

    const tableName = this.getTableName(storeId);
    const tableNames = await this.connection.tableNames();

    if (!tableNames.includes(tableName)) {
      // Create table with initial schema
      const table = await this.connection.createTable(tableName, [
        {
          id: '__init__',
          content: '',
          vector: new Array(384).fill(0),
          metadata: '{}',
        },
      ]);
      // Delete the init row
      await table.delete('id = "__init__"');
      this.tables.set(tableName, table);
    } else {
      const table = await this.connection.openTable(tableName);
      this.tables.set(tableName, table);
    }
  }

  async addDocuments(storeId: StoreId, documents: Document[]): Promise<void> {
    const table = await this.getTable(storeId);
    const lanceDocuments: LanceDocument[] = documents.map((doc) => ({
      id: doc.id,
      content: doc.content,
      vector: [...doc.vector],
      metadata: JSON.stringify(doc.metadata),
    }));
    await table.add(lanceDocuments);
  }

  async deleteDocuments(storeId: StoreId, documentIds: DocumentId[]): Promise<void> {
    const table = await this.getTable(storeId);
    const idList = documentIds.map((id) => `"${id}"`).join(', ');
    await table.delete(`id IN (${idList})`);
  }

  async search(
    storeId: StoreId,
    vector: number[],
    limit: number,
    // threshold is kept for API compatibility but filtering is done after normalization
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _threshold?: number
  ): Promise<
    Array<{ id: DocumentId; content: string; score: number; metadata: DocumentMetadata }>
  > {
    const table = await this.getTable(storeId);
    const query = table.vectorSearch(vector).limit(limit).distanceType('cosine');

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const results = (await query.toArray()) as SearchHit[];

    // Return all results - threshold filtering is applied after score normalization
    // in search.service.ts to match displayed scores
    return results.map((r) => ({
      id: createDocumentId(r.id),
      content: r.content,
      score: 1 - r._distance,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      metadata: JSON.parse(r.metadata) as DocumentMetadata,
    }));
  }

  async createFtsIndex(storeId: StoreId): Promise<void> {
    const table = await this.getTable(storeId);
    await table.createIndex('content', {
      config: lancedb.Index.fts(),
    });
  }

  async fullTextSearch(
    storeId: StoreId,
    query: string,
    limit: number
  ): Promise<
    Array<{ id: DocumentId; content: string; score: number; metadata: DocumentMetadata }>
  > {
    const table = await this.getTable(storeId);

    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const results = (await table.search(query, 'fts').limit(limit).toArray()) as Array<{
        id: string;
        content: string;
        metadata: string;
        _score: number;
      }>;

      return results.map((r) => ({
        id: createDocumentId(r.id),
        content: r.content,
        score: r._score,
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        metadata: JSON.parse(r.metadata) as DocumentMetadata,
      }));
    } catch {
      // FTS index may not exist, return empty
      return [];
    }
  }

  async deleteStore(storeId: StoreId): Promise<void> {
    const tableName = this.getTableName(storeId);
    if (this.connection !== null) {
      await this.connection.dropTable(tableName);
      this.tables.delete(tableName);
    }
  }

  close(): void {
    this.tables.clear();
    if (this.connection !== null) {
      this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Async close that allows native code cleanup time.
   * Use this before process.exit() to prevent mutex crashes.
   */
  async closeAsync(): Promise<void> {
    this.tables.clear();
    if (this.connection !== null) {
      this.connection.close();
      this.connection = null;
      // Allow native threads time to complete cleanup
      // LanceDB's native code has background threads that need time
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private getTableName(storeId: StoreId): string {
    return `documents_${storeId}`;
  }

  private async getTable(storeId: StoreId): Promise<Table> {
    const tableName = this.getTableName(storeId);
    let table = this.tables.get(tableName);
    if (table === undefined) {
      await this.initialize(storeId);
      table = this.tables.get(tableName);
    }
    if (table === undefined) {
      throw new Error(`Table not found for store: ${storeId}`);
    }
    return table;
  }
}
