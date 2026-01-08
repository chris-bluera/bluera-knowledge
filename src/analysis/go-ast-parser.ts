import {
  parseGoCode,
  queryNodesByType,
  positionToLineNumber,
  getChildByFieldName,
  getFunctionSignature,
  getFirstChildOfType,
  type TreeSitterNode,
  type TreeSitterTree,
} from './tree-sitter-parser.js';
import type { CodeNode, ImportInfo } from './ast-parser.js';

/**
 * Parser for Go code using tree-sitter
 * Extracts functions, methods, structs, interfaces, types, constants, and imports
 */
export class GoASTParser {
  /**
   * Parse Go code into CodeNode array
   * @param code Go source code
   * @param filePath File path for error context
   * @returns Array of CodeNode objects representing Go constructs
   */
  parse(code: string, _filePath: string): CodeNode[] {
    try {
      const tree = parseGoCode(code);
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

      // Parse interfaces
      const interfaces = this.parseInterfaces(tree);
      nodes.push(...interfaces);

      // Parse type aliases
      const types = this.parseTypeAliases(tree);
      nodes.push(...types);

      // Parse constants and variables
      const constants = this.parseConstants(tree);
      nodes.push(...constants);

      // Parse methods and attach to structs
      this.parseMethods(tree, nodes);

      return nodes;
    } catch {
      // Return empty array for any parsing errors
      return [];
    }
  }

  /**
   * Extract imports from Go code
   * @param code Go source code
   * @returns Array of ImportInfo objects
   */
  extractImports(code: string): ImportInfo[] {
    try {
      const tree = parseGoCode(code);
      if (tree === null) {
        return [];
      }

      const imports: ImportInfo[] = [];
      const importDecls = queryNodesByType(tree, 'import_declaration');

      for (const importDecl of importDecls) {
        const importSpecs = importDecl.descendantsOfType('import_spec');

        for (const spec of importSpecs) {
          const pathNode = getChildByFieldName(spec, 'path');
          if (pathNode === null) {
            continue;
          }

          // Extract string content from interpreted_string_literal
          const stringContent = pathNode.descendantsOfType('interpreted_string_literal_content')[0];
          const path =
            stringContent !== undefined ? stringContent.text : pathNode.text.replace(/"/g, '');

          if (path !== '') {
            imports.push({
              source: path,
              specifiers: [],
              isType: false,
            });
          }
        }
      }

      return imports;
    } catch {
      return [];
    }
  }

  /**
   * Parse function declarations
   */
  private parseFunctions(tree: TreeSitterTree): CodeNode[] {
    const functionNodes = queryNodesByType(tree, 'function_declaration');
    const nodes: CodeNode[] = [];

    for (const fnNode of functionNodes) {
      const nameNode = getChildByFieldName(fnNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const exported = this.isExported(name);
      const startLine = positionToLineNumber(fnNode.startPosition);
      const endLine = positionToLineNumber(fnNode.endPosition);
      const signature = getFunctionSignature(fnNode);

      nodes.push({
        type: 'function',
        name,
        exported,
        async: false,
        startLine,
        endLine,
        signature,
      });
    }

    return nodes;
  }

  /**
   * Parse struct definitions
   */
  private parseStructs(tree: TreeSitterTree): CodeNode[] {
    const typeDecls = queryNodesByType(tree, 'type_declaration');
    const nodes: CodeNode[] = [];

    for (const typeDecl of typeDecls) {
      // Get type_spec child node
      const typeSpec = getFirstChildOfType(typeDecl, 'type_spec');
      if (typeSpec === null) {
        continue;
      }

      const nameNode = getChildByFieldName(typeSpec, 'name');
      const typeNode = getChildByFieldName(typeSpec, 'type');

      if (nameNode === null || typeNode === null) {
        continue;
      }

      // Check if it's a struct type
      if (typeNode.type !== 'struct_type') {
        continue;
      }

      const name = nameNode.text;
      const exported = this.isExported(name);
      const startLine = positionToLineNumber(typeDecl.startPosition);
      const endLine = positionToLineNumber(typeDecl.endPosition);

      nodes.push({
        type: 'class',
        name,
        exported,
        startLine,
        endLine,
        signature: name,
        methods: [],
      });
    }

    return nodes;
  }

  /**
   * Parse interface definitions
   */
  private parseInterfaces(tree: TreeSitterTree): CodeNode[] {
    const typeDecls = queryNodesByType(tree, 'type_declaration');
    const nodes: CodeNode[] = [];

    for (const typeDecl of typeDecls) {
      const typeSpec = getFirstChildOfType(typeDecl, 'type_spec');
      if (typeSpec === null) {
        continue;
      }

      const nameNode = getChildByFieldName(typeSpec, 'name');
      const typeNode = getChildByFieldName(typeSpec, 'type');

      if (nameNode === null || typeNode === null) {
        continue;
      }

      // Check if it's an interface type
      if (typeNode.type !== 'interface_type') {
        continue;
      }

      const name = nameNode.text;
      const exported = this.isExported(name);
      const startLine = positionToLineNumber(typeDecl.startPosition);
      const endLine = positionToLineNumber(typeDecl.endPosition);

      // Extract interface methods
      const methods = this.extractInterfaceMethods(typeNode);

      nodes.push({
        type: 'interface',
        name,
        exported,
        startLine,
        endLine,
        signature: name,
        methods,
      });
    }

    return nodes;
  }

  /**
   * Parse type aliases
   */
  private parseTypeAliases(tree: TreeSitterTree): CodeNode[] {
    const typeDecls = queryNodesByType(tree, 'type_declaration');
    const nodes: CodeNode[] = [];

    for (const typeDecl of typeDecls) {
      const typeSpec = getFirstChildOfType(typeDecl, 'type_spec');
      if (typeSpec === null) {
        continue;
      }

      const nameNode = getChildByFieldName(typeSpec, 'name');
      const typeNode = getChildByFieldName(typeSpec, 'type');

      if (nameNode === null || typeNode === null) {
        continue;
      }

      // Skip struct and interface types (handled by other methods)
      if (typeNode.type === 'struct_type' || typeNode.type === 'interface_type') {
        continue;
      }

      const name = nameNode.text;
      const exported = this.isExported(name);
      const startLine = positionToLineNumber(typeDecl.startPosition);
      const endLine = positionToLineNumber(typeDecl.endPosition);
      const signature = `${name} = ${typeNode.text}`;

      nodes.push({
        type: 'type',
        name,
        exported,
        startLine,
        endLine,
        signature,
      });
    }

    return nodes;
  }

  /**
   * Parse constants and variables
   */
  private parseConstants(tree: TreeSitterTree): CodeNode[] {
    const nodes: CodeNode[] = [];

    // Parse const declarations
    const constDecls = queryNodesByType(tree, 'const_declaration');
    for (const constDecl of constDecls) {
      const specs = constDecl.descendantsOfType('const_spec');
      for (const spec of specs) {
        const nameNode = getChildByFieldName(spec, 'name');
        if (nameNode === null) {
          continue;
        }

        const name = nameNode.text;
        const exported = this.isExported(name);
        const startLine = positionToLineNumber(spec.startPosition);
        const endLine = positionToLineNumber(spec.endPosition);

        const typeNode = getChildByFieldName(spec, 'type');
        const signature = typeNode !== null ? `${name}: ${typeNode.text}` : name;

        nodes.push({
          type: 'const',
          name,
          exported,
          startLine,
          endLine,
          signature,
        });
      }
    }

    // Parse var declarations
    const varDecls = queryNodesByType(tree, 'var_declaration');
    for (const varDecl of varDecls) {
      const specs = varDecl.descendantsOfType('var_spec');
      for (const spec of specs) {
        const nameNode = getChildByFieldName(spec, 'name');
        if (nameNode === null) {
          continue;
        }

        const name = nameNode.text;
        const exported = this.isExported(name);
        const startLine = positionToLineNumber(spec.startPosition);
        const endLine = positionToLineNumber(spec.endPosition);

        const typeNode = getChildByFieldName(spec, 'type');
        const signature = typeNode !== null ? `${name}: ${typeNode.text}` : name;

        nodes.push({
          type: 'const',
          name,
          exported,
          startLine,
          endLine,
          signature,
        });
      }
    }

    return nodes;
  }

  /**
   * Parse methods and attach to corresponding structs
   */
  private parseMethods(tree: TreeSitterTree, nodes: CodeNode[]): void {
    const methodNodes = queryNodesByType(tree, 'method_declaration');

    for (const methodNode of methodNodes) {
      const receiverType = this.getReceiverType(methodNode);
      if (receiverType === null) {
        continue;
      }

      const nameNode = getChildByFieldName(methodNode, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const signature = getFunctionSignature(methodNode);
      const startLine = positionToLineNumber(methodNode.startPosition);
      const endLine = positionToLineNumber(methodNode.endPosition);

      // Find the corresponding struct and attach method
      const structNode = nodes.find((node) => node.type === 'class' && node.name === receiverType);

      if (structNode?.methods !== undefined) {
        structNode.methods.push({
          name,
          async: false,
          signature,
          startLine,
          endLine,
        });
      }
    }
  }

  /**
   * Extract methods from interface definition
   */
  private extractInterfaceMethods(interfaceNode: TreeSitterNode): Array<{
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

    const methodElems = interfaceNode.descendantsOfType('method_elem');

    for (const methodElem of methodElems) {
      const nameNode = getChildByFieldName(methodElem, 'name');
      if (nameNode === null) {
        continue;
      }

      const name = nameNode.text;
      const signature = getFunctionSignature(methodElem);
      const startLine = positionToLineNumber(methodElem.startPosition);
      const endLine = positionToLineNumber(methodElem.endPosition);

      methods.push({
        name,
        async: false,
        signature,
        startLine,
        endLine,
      });
    }

    return methods;
  }

  /**
   * Get the receiver type name for a method
   */
  private getReceiverType(methodNode: TreeSitterNode): string | null {
    const receiverNode = getChildByFieldName(methodNode, 'receiver');
    if (receiverNode === null) {
      return null;
    }

    const paramDecl = getFirstChildOfType(receiverNode, 'parameter_declaration');
    if (paramDecl === null) {
      return null;
    }

    const typeNode = getChildByFieldName(paramDecl, 'type');
    if (typeNode === null) {
      return null;
    }

    // Handle pointer receivers (*Type)
    if (typeNode.type === 'pointer_type') {
      const innerType = typeNode.children.find((child) => child.type === 'type_identifier');
      return innerType !== undefined ? innerType.text : null;
    }

    // Handle value receivers (Type)
    if (typeNode.type === 'type_identifier') {
      return typeNode.text;
    }

    return null;
  }

  /**
   * Check if a name is exported (starts with uppercase letter)
   */
  private isExported(name: string): boolean {
    if (name.length === 0) {
      return false;
    }
    const firstChar = name[0];
    if (firstChar === undefined) {
      return false;
    }
    return firstChar === firstChar.toUpperCase();
  }
}
