import Parser from 'tree-sitter';
import Go from 'tree-sitter-go';
import Rust from 'tree-sitter-rust';

/**
 * Tree-sitter infrastructure for parsing Rust and Go code.
 * Provides utilities for AST traversal, querying, and position conversion.
 */

export interface TreeSitterPosition {
  row: number;
  column: number;
}

export interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: TreeSitterPosition;
  endPosition: TreeSitterPosition;
  startIndex: number;
  endIndex: number;
  childCount: number;
  namedChildCount: number;
  children: TreeSitterNode[];
  namedChildren: TreeSitterNode[];
  parent: TreeSitterNode | null;
  nextSibling: TreeSitterNode | null;
  previousSibling: TreeSitterNode | null;
  firstChild: TreeSitterNode | null;
  lastChild: TreeSitterNode | null;
  firstNamedChild: TreeSitterNode | null;
  lastNamedChild: TreeSitterNode | null;
  child(index: number): TreeSitterNode | null;
  namedChild(index: number): TreeSitterNode | null;
  childForFieldName(fieldName: string): TreeSitterNode | null;
  descendantsOfType(type: string | string[]): TreeSitterNode[];
}

export interface TreeSitterTree {
  rootNode: TreeSitterNode;
  edit(delta: unknown): void;
  walk(): unknown;
}

/**
 * Initialize a tree-sitter parser for Rust
 */
export function createRustParser(): Parser {
  const parser = new Parser();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tree-sitter-rust lacks TypeScript definitions
  parser.setLanguage(Rust as Parser.Language);
  return parser;
}

/**
 * Parse Rust source code into an AST
 */
export function parseRustCode(code: string): TreeSitterTree | null {
  try {
    const parser = createRustParser();
    return parser.parse(code);
  } catch {
    // Return null for malformed code
    return null;
  }
}

/**
 * Initialize a tree-sitter parser for Go
 */
export function createGoParser(): Parser {
  const parser = new Parser();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- tree-sitter-go lacks TypeScript definitions
  parser.setLanguage(Go as Parser.Language);
  return parser;
}

/**
 * Parse Go source code into an AST
 */
export function parseGoCode(code: string): TreeSitterTree | null {
  try {
    const parser = createGoParser();
    return parser.parse(code);
  } catch {
    // Return null for malformed code
    return null;
  }
}

/**
 * Convert tree-sitter position (0-indexed) to line number (1-indexed)
 */
export function positionToLineNumber(position: TreeSitterPosition): number {
  return position.row + 1;
}

/**
 * Get the text content of a node
 */
export function getNodeText(node: TreeSitterNode): string {
  return node.text;
}

/**
 * Get all children of a specific type
 */
export function getChildrenOfType(node: TreeSitterNode, type: string): TreeSitterNode[] {
  return node.children.filter((child) => child.type === type);
}

/**
 * Get the first child of a specific type
 */
export function getFirstChildOfType(node: TreeSitterNode, type: string): TreeSitterNode | null {
  return node.children.find((child) => child.type === type) ?? null;
}

/**
 * Get child by field name (e.g., "name", "body", "parameters")
 */
export function getChildByFieldName(
  node: TreeSitterNode,
  fieldName: string
): TreeSitterNode | null {
  return node.childForFieldName(fieldName);
}

/**
 * Check if node has a visibility modifier (pub)
 */
export function hasVisibilityModifier(node: TreeSitterNode): boolean {
  return node.children.some((child) => child.type === 'visibility_modifier');
}

/**
 * Get visibility modifier text (e.g., "pub", "pub(crate)")
 */
export function getVisibilityModifier(node: TreeSitterNode): string | null {
  const visNode = node.children.find((child) => child.type === 'visibility_modifier');
  return visNode !== undefined ? visNode.text : null;
}

/**
 * Check if a function is async
 */
export function isAsyncFunction(node: TreeSitterNode): boolean {
  // Check for 'async' keyword in function_item or function_signature_item
  return node.children.some((child) => child.type === 'async' || child.text === 'async');
}

/**
 * Check if a function is unsafe
 */
export function isUnsafeFunction(node: TreeSitterNode): boolean {
  return node.children.some((child) => child.type === 'unsafe' || child.text === 'unsafe');
}

/**
 * Extract function signature including generics and parameters
 */
export function getFunctionSignature(node: TreeSitterNode): string {
  // Extract the full signature by getting text from name to return type
  const nameNode = getChildByFieldName(node, 'name');
  const parametersNode = getChildByFieldName(node, 'parameters');
  const returnTypeNode = getChildByFieldName(node, 'return_type');
  const typeParametersNode = getChildByFieldName(node, 'type_parameters');

  if (nameNode === null) {
    return '';
  }

  let signature = nameNode.text;

  // Add type parameters (generics)
  if (typeParametersNode !== null) {
    signature += typeParametersNode.text;
  }

  // Add parameters
  if (parametersNode !== null) {
    signature += parametersNode.text;
  }

  // Add return type
  if (returnTypeNode !== null) {
    signature += ` ${returnTypeNode.text}`;
  }

  return signature;
}

/**
 * Query nodes of specific type from the tree
 * @param tree The tree-sitter tree
 * @param nodeType The type of nodes to find (e.g., 'function_item', 'struct_item')
 * @returns Array of matching nodes
 */
export function queryNodesByType(
  tree: TreeSitterTree,
  nodeType: string | string[]
): TreeSitterNode[] {
  const types = Array.isArray(nodeType) ? nodeType : [nodeType];
  return tree.rootNode.descendantsOfType(types);
}

/**
 * Extract use statement import path
 */
export function extractImportPath(useNode: TreeSitterNode): string {
  // Get the use_declaration argument
  const argumentNode = getChildByFieldName(useNode, 'argument');
  if (argumentNode === null) {
    return '';
  }
  return argumentNode.text;
}
