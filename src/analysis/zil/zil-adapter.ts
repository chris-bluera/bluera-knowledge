/**
 * ZIL Language Adapter
 *
 * Implements LanguageAdapter for ZIL (Zork Implementation Language).
 * Provides full graph support: parsing, imports, chunking, and call analysis.
 */

import { ZilParser } from './zil-parser.js';
import type { CodeNode, ImportInfo } from '../ast-parser.js';
import type { GraphEdge } from '../code-graph.js';
import type { LanguageAdapter, ChunkResult } from '../language-adapter.js';

/**
 * Language adapter for ZIL (Zork Implementation Language)
 */
export class ZilAdapter implements LanguageAdapter {
  readonly languageId = 'zil';
  readonly extensions = ['.zil', '.mud'];
  readonly displayName = 'ZIL (Zork Implementation Language)';

  private readonly parser = new ZilParser();

  /**
   * Parse ZIL code and extract symbols as CodeNode[]
   */
  parse(content: string, _filePath: string): CodeNode[] {
    const result = this.parser.parse(content);

    return result.symbols.map((symbol) => {
      const node: CodeNode = {
        type: this.mapSymbolKindToNodeType(symbol.kind),
        name: symbol.name,
        exported: true, // ZIL doesn't have export concept, treat all as exported
        startLine: symbol.startLine,
        endLine: symbol.endLine,
      };

      if (symbol.signature !== undefined) {
        node.signature = symbol.signature;
      }

      return node;
    });
  }

  /**
   * Extract imports from INSERT-FILE directives
   */
  extractImports(content: string, _filePath: string): ImportInfo[] {
    const result = this.parser.parse(content);
    return result.imports;
  }

  /**
   * Chunk ZIL code by top-level forms
   */
  chunk(content: string, _filePath: string): ChunkResult[] {
    const result = this.parser.parse(content);
    const lines = content.split('\n');

    return result.forms
      .filter((form) => form.head !== '') // Skip empty forms
      .map((form) => {
        // Extract content from original source using line numbers
        const chunkLines = lines.slice(form.startLine - 1, form.endLine);
        const chunkContent = chunkLines.join('\n');

        // Find symbol for this form if it's a definition
        const symbol = result.symbols.find(
          (s) => s.startLine === form.startLine && s.endLine === form.endLine
        );

        const chunk: ChunkResult = {
          content: chunkContent,
          startLine: form.startLine,
          endLine: form.endLine,
        };

        if (symbol !== undefined) {
          chunk.symbolName = symbol.name;
          chunk.symbolKind = symbol.kind;
        }

        return chunk;
      });
  }

  /**
   * Analyze call relationships within ZIL code
   */
  analyzeCallRelationships(content: string, filePath: string): GraphEdge[] {
    const result = this.parser.parse(content);

    return result.calls.map((call) => ({
      from: `${filePath}:${call.caller}`,
      to: `${filePath}:${call.callee}`,
      type: 'calls' as const,
      confidence: 0.9, // High confidence for ZIL - calls are explicit
    }));
  }

  /**
   * Map ZIL symbol kinds to CodeNode types
   */
  private mapSymbolKindToNodeType(kind: string): CodeNode['type'] {
    switch (kind) {
      case 'routine':
        return 'function';
      case 'object':
      case 'room':
      case 'global':
      case 'constant':
        return 'const';
      case 'syntax':
      case 'verb':
        return 'const';
      default:
        return 'const';
    }
  }
}
