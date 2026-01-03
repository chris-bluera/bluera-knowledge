import type { CodeNode, ImportInfo } from './ast-parser.js';
import {
  parseRustCode,
  queryNodesByType,
  positionToLineNumber,
  getChildByFieldName,
  hasVisibilityModifier,
  isAsyncFunction,
  getFunctionSignature,
  extractImportPath,
  type TreeSitterNode,
  type TreeSitterTree
} from './tree-sitter-parser.js';

/**
 * Parser for Rust code using tree-sitter
 * Extracts functions, structs, traits, types, constants, and imports
 */
export class RustASTParser {
  /**
   * Parse Rust code into CodeNode array
   * @param code Rust source code
   * @param filePath File path for error context
   * @returns Array of CodeNode objects representing Rust constructs
   */
  parse(code: string, _filePath: string): CodeNode[] {
    try {
      const tree = parseRustCode(code);
      if (tree === null) {
        // Malformed code - return empty array
        return [];
      }

      const nodes: CodeNode[] = [];

      // Parse functions
      const functions = this.parseFunctions(tree);
      nodes.push(...functions);

      // Parse structs
      const structs = this.parseStructs(tree);
      nodes.push(...structs);

      // Parse traits
      const traits = this.parseTraits(tree);
      nodes.push(...traits);

      // Parse type aliases
      const types = this.parseTypeAliases(tree);
      nodes.push(...types);

      // Parse constants and statics
      const constants = this.parseConstants(tree);
      nodes.push(...constants);

      // Parse impl blocks and attach methods to structs
      this.parseImplBlocks(tree, nodes);

      return nodes;
    } catch {
      // Return empty array for any parsing errors
      return [];
    }
  }

  /**
   * Extract imports from Rust code
   * @param code Rust source code
   * @returns Array of ImportInfo objects
   */
  extractImports(code: string): ImportInfo[] {
    try {
      const tree = parseRustCode(code);
      if (tree === null) {
        return [];
      }

      const useDeclarations = queryNodesByType(tree, 'use_declaration');
      const imports: ImportInfo[] = [];

      for (const useNode of useDeclarations) {
        const importPath = extractImportPath(useNode);
        if (importPath === '') {
          continue;
        }

        // Parse the import path to extract module and specifiers
        const { source, specifiers } = this.parseImportPath(importPath);

        imports.push({
          source,
          specifiers,
          isType: false // Rust doesn't distinguish type-only imports at syntax level
        });
      }

      return imports;
    } catch {
      return [];
    }
  }

  /**
   * Parse function declarations (excluding impl block methods)
   */
  private parseFunctions(tree: TreeSitterTree): CodeNode[] {
    const functionNodes = queryNodesByType(tree, 'function_item');
    const nodes: CodeNode[] = [];

    for (const fnNode of functionNodes) {
      // Skip functions inside impl blocks - they'll be handled as methods
      if (this.isInsideImplBlock(fnNode)) {
        continue;
      }

      const nameNode = getChildByFieldName(fnNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = hasVisibilityModifier(fnNode);
      const async = isAsyncFunction(fnNode);
      const startLine = positionToLineNumber(fnNode.startPosition);
      const endLine = positionToLineNumber(fnNode.endPosition);
      const signature = getFunctionSignature(fnNode);

      nodes.push({
        type: 'function',
        name,
        exported,
        async,
        startLine,
        endLine,
        signature
      });
    }

    return nodes;
  }

  /**
   * Check if a node is inside an impl block
   */
  private isInsideImplBlock(node: TreeSitterNode): boolean {
    let current = node.parent;
    while (current !== null) {
      if (current.type === 'impl_item') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Parse struct definitions
   */
  private parseStructs(tree: TreeSitterTree): CodeNode[] {
    const structNodes = queryNodesByType(tree, 'struct_item');
    const nodes: CodeNode[] = [];

    for (const structNode of structNodes) {
      const nameNode = getChildByFieldName(structNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = hasVisibilityModifier(structNode);
      const startLine = positionToLineNumber(structNode.startPosition);
      const endLine = positionToLineNumber(structNode.endPosition);

      // Get type parameters (generics) if present
      const typeParamsNode = getChildByFieldName(structNode, 'type_parameters');
      const signature = typeParamsNode !== null
        ? `${name}${typeParamsNode.text}`
        : name;

      nodes.push({
        type: 'class',
        name,
        exported,
        startLine,
        endLine,
        signature,
        methods: [] // Will be populated by parseImplBlocks
      });
    }

    return nodes;
  }

  /**
   * Parse trait definitions
   */
  private parseTraits(tree: TreeSitterTree): CodeNode[] {
    const traitNodes = queryNodesByType(tree, 'trait_item');
    const nodes: CodeNode[] = [];

    for (const traitNode of traitNodes) {
      const nameNode = getChildByFieldName(traitNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = hasVisibilityModifier(traitNode);
      const startLine = positionToLineNumber(traitNode.startPosition);
      const endLine = positionToLineNumber(traitNode.endPosition);

      // Get type parameters (generics) if present
      const typeParamsNode = getChildByFieldName(traitNode, 'type_parameters');
      const signature = typeParamsNode !== null
        ? `${name}${typeParamsNode.text}`
        : name;

      // Extract trait methods
      const methods = this.extractTraitMethods(traitNode);

      nodes.push({
        type: 'interface',
        name,
        exported,
        startLine,
        endLine,
        signature,
        methods
      });
    }

    return nodes;
  }

  /**
   * Parse type aliases
   */
  private parseTypeAliases(tree: TreeSitterTree): CodeNode[] {
    const typeNodes = queryNodesByType(tree, 'type_item');
    const nodes: CodeNode[] = [];

    for (const typeNode of typeNodes) {
      const nameNode = getChildByFieldName(typeNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = hasVisibilityModifier(typeNode);
      const startLine = positionToLineNumber(typeNode.startPosition);
      const endLine = positionToLineNumber(typeNode.endPosition);

      // Get the full type alias definition
      const valueNode = getChildByFieldName(typeNode, 'type');
      const signature = valueNode !== null
        ? `${name} = ${valueNode.text}`
        : name;

      nodes.push({
        type: 'type',
        name,
        exported,
        startLine,
        endLine,
        signature
      });
    }

    return nodes;
  }

  /**
   * Parse constants and statics
   */
  private parseConstants(tree: TreeSitterTree): CodeNode[] {
    const constNodes = queryNodesByType(tree, ['const_item', 'static_item']);
    const nodes: CodeNode[] = [];

    for (const constNode of constNodes) {
      const nameNode = getChildByFieldName(constNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = hasVisibilityModifier(constNode);
      const startLine = positionToLineNumber(constNode.startPosition);
      const endLine = positionToLineNumber(constNode.endPosition);

      // Get type annotation
      const typeNode = getChildByFieldName(constNode, 'type');
      const signature = typeNode !== null
        ? `${name}: ${typeNode.text}`
        : name;

      nodes.push({
        type: 'const',
        name,
        exported,
        startLine,
        endLine,
        signature
      });
    }

    return nodes;
  }

  /**
   * Parse impl blocks and attach methods to corresponding structs
   */
  private parseImplBlocks(tree: TreeSitterTree, nodes: CodeNode[]): void {
    const implNodes = queryNodesByType(tree, 'impl_item');

    for (const implNode of implNodes) {
      // Get the type being implemented
      const typeNode = getChildByFieldName(implNode, 'type');
      if (typeNode === null) {
        continue;
      }

      const typeName = typeNode.text;

      // Extract methods from impl block
      const methods = this.extractImplMethods(implNode);

      // Find the corresponding struct and attach methods
      const structNode = nodes.find(
        node => node.type === 'class' && node.name === typeName
      );

      if (structNode !== undefined && structNode.methods !== undefined) {
        structNode.methods.push(...methods);
      }
    }
  }

  /**
   * Extract methods from trait definition
   */
  private extractTraitMethods(traitNode: TreeSitterNode): Array<{
    name: string;
    async: boolean;
    signature: string;
    startLine: number;
    endLine: number;
  }> {
    const methods: Array<{
      name: string;
      async: boolean;
      signature: string;
      startLine: number;
      endLine: number;
    }> = [];

    // Get declaration_list (trait body)
    const bodyNode = getChildByFieldName(traitNode, 'body');
    if (bodyNode === null) {
      return methods;
    }

    // Find all function_signature_item nodes (trait method declarations)
    const functionSignatures = bodyNode.descendantsOfType('function_signature_item');

    for (const fnSigNode of functionSignatures) {
      const nameNode = getChildByFieldName(fnSigNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const async = isAsyncFunction(fnSigNode);
      const signature = getFunctionSignature(fnSigNode);
      const startLine = positionToLineNumber(fnSigNode.startPosition);
      const endLine = positionToLineNumber(fnSigNode.endPosition);

      methods.push({
        name,
        async,
        signature,
        startLine,
        endLine
      });
    }

    return methods;
  }

  /**
   * Extract methods from impl block
   */
  private extractImplMethods(implNode: TreeSitterNode): Array<{
    name: string;
    async: boolean;
    signature: string;
    startLine: number;
    endLine: number;
  }> {
    const methods: Array<{
      name: string;
      async: boolean;
      signature: string;
      startLine: number;
      endLine: number;
    }> = [];

    // Get declaration_list (impl body)
    const bodyNode = getChildByFieldName(implNode, 'body');
    if (bodyNode === null) {
      return methods;
    }

    // Find all function_item nodes (impl methods)
    const functionItems = bodyNode.descendantsOfType('function_item');

    for (const fnNode of functionItems) {
      const nameNode = getChildByFieldName(fnNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const async = isAsyncFunction(fnNode);
      const signature = getFunctionSignature(fnNode);
      const startLine = positionToLineNumber(fnNode.startPosition);
      const endLine = positionToLineNumber(fnNode.endPosition);

      methods.push({
        name,
        async,
        signature,
        startLine,
        endLine
      });
    }

    return methods;
  }

  /**
   * Parse import path into source and specifiers
   * Examples:
   * - "std::collections::HashMap" -> { source: "std::collections", specifiers: ["HashMap"] }
   * - "crate::utils::*" -> { source: "crate::utils", specifiers: ["*"] }
   * - "super::Type" -> { source: "super", specifiers: ["Type"] }
   */
  private parseImportPath(importPath: string): { source: string; specifiers: string[] } {
    // Remove whitespace
    const path = importPath.trim();

    // Handle glob imports (use std::io::*)
    if (path.includes('::*')) {
      const source = path.replace('::*', '');
      return { source, specifiers: ['*'] };
    }

    // Handle scoped imports: use std::io::{Read, Write}
    const scopedMatch = path.match(/^(.+)::\{(.+)\}$/);
    if (scopedMatch !== null) {
      const source = scopedMatch[1] ?? '';
      const specifiersStr = scopedMatch[2] ?? '';
      const specifiers = specifiersStr.split(',').map(s => s.trim());
      return { source, specifiers };
    }

    // Handle simple imports: use std::collections::HashMap
    const parts = path.split('::');
    if (parts.length > 1) {
      const specifiers = [parts[parts.length - 1] ?? ''];
      const source = parts.slice(0, -1).join('::');
      return { source, specifiers };
    }

    // Single item import
    return { source: '', specifiers: [path] };
  }
}
