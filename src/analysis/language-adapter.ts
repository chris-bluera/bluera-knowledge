/**
 * Language Adapter Interface
 *
 * Defines the contract for custom language support in bluera-knowledge.
 * Adapters provide language-specific parsing, import extraction, chunking,
 * and call relationship analysis.
 *
 * Built-in adapters: ZIL (Zork Implementation Language)
 * Users can create custom adapters for any language.
 */

import type { CodeNode, ImportInfo } from './ast-parser.js';
import type { GraphEdge } from './code-graph.js';

/**
 * Result of chunking a file into logical units
 */
export interface ChunkResult {
  /** The content of the chunk */
  content: string;
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based) */
  endLine: number;
  /** Optional symbol name this chunk represents */
  symbolName?: string;
  /** Optional symbol kind (routine, object, class, etc.) */
  symbolKind?: string;
}

/**
 * Interface for language-specific parsing and analysis.
 *
 * Adapters enable full graph support for custom languages:
 * - Smart chunking by language constructs
 * - Symbol extraction (functions, classes, objects)
 * - Import/include relationship tracking
 * - Call graph analysis
 *
 * @example
 * ```typescript
 * const zilAdapter: LanguageAdapter = {
 *   languageId: 'zil',
 *   extensions: ['.zil', '.mud'],
 *   displayName: 'ZIL (Zork Implementation Language)',
 *
 *   parse(content, filePath) {
 *     // Extract routines, objects, rooms, globals
 *     return [...];
 *   },
 *
 *   extractImports(content, filePath) {
 *     // Find INSERT-FILE directives
 *     return [...];
 *   },
 *
 *   chunk(content, filePath) {
 *     // Split by top-level forms
 *     return [...];
 *   }
 * };
 * ```
 */
export interface LanguageAdapter {
  /**
   * Unique identifier for this language.
   * Used for registry lookup and configuration.
   * @example 'zil', 'cobol', 'fortran'
   */
  readonly languageId: string;

  /**
   * File extensions this adapter handles (with leading dot).
   * @example ['.zil', '.mud'] or ['.cbl', '.cob']
   */
  readonly extensions: string[];

  /**
   * Human-readable name for the language.
   * @example 'ZIL (Zork Implementation Language)'
   */
  readonly displayName: string;

  /**
   * Parse file content and extract code symbols.
   *
   * @param content - File content as string
   * @param filePath - Path to the file (for error messages)
   * @returns Array of code nodes (functions, classes, etc.)
   */
  parse(content: string, filePath: string): CodeNode[];

  /**
   * Extract import/include statements from file content.
   *
   * @param content - File content as string
   * @param filePath - Path to the file (for resolving relative imports)
   * @returns Array of import information
   */
  extractImports(content: string, filePath: string): ImportInfo[];

  /**
   * Optional: Split file into logical chunks for indexing.
   *
   * If not provided, the default chunking strategy is used.
   * Custom chunking improves search quality by aligning chunks
   * with language constructs (functions, classes, etc.).
   *
   * @param content - File content as string
   * @param filePath - Path to the file
   * @returns Array of chunk results
   */
  chunk?(content: string, filePath: string): ChunkResult[];

  /**
   * Optional: Analyze call relationships within a file.
   *
   * If not provided, the default regex-based call detection is used.
   * Custom analysis can filter language-specific special forms
   * and provide higher-confidence edges.
   *
   * @param content - File content as string
   * @param filePath - Path to the file
   * @returns Array of graph edges representing calls
   */
  analyzeCallRelationships?(content: string, filePath: string): GraphEdge[];
}
