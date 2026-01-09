/**
 * ZIL Parser
 *
 * Parses ZIL source code into an AST-like structure and extracts:
 * - Symbols (ROUTINE, OBJECT, ROOM, GLOBAL, CONSTANT, SYNTAX)
 * - Imports (INSERT-FILE)
 * - Call relationships (filtering out special forms)
 */

import { ZilLexer, TokenType, type Token } from './zil-lexer.js';
import { isSpecialForm, isDefinitionForm } from './zil-special-forms.js';
import type { ImportInfo } from '../ast-parser.js';

/**
 * A ZIL form node (angle-bracket expression)
 */
export interface ZilForm {
  /** The head/operator of the form (first atom after <) */
  head: string;
  /** Child nodes (atoms, strings, numbers, nested forms) */
  children: ZilNode[];
  /** Starting line number */
  startLine: number;
  /** Ending line number */
  endLine: number;
}

/**
 * A parenthesized group (used for args lists)
 */
export interface ZilGroup {
  type: 'group';
  children: ZilNode[];
  startLine: number;
  endLine: number;
}

/**
 * A leaf node (atom, string, or number)
 */
export interface ZilLeaf {
  type: 'atom' | 'string' | 'number';
  value: string;
  line: number;
}

export type ZilNode = ZilForm | ZilGroup | ZilLeaf;

/**
 * Extracted symbol from ZIL code
 */
export interface ZilSymbol {
  name: string;
  kind: 'routine' | 'object' | 'room' | 'global' | 'constant' | 'syntax' | 'verb';
  startLine: number;
  endLine: number;
  signature?: string;
}

/**
 * A function call extracted from ZIL code
 */
export interface ZilCall {
  caller: string;
  callee: string;
  line: number;
}

/**
 * Result of parsing a ZIL file
 */
export interface ZilParseResult {
  forms: ZilForm[];
  symbols: ZilSymbol[];
  imports: ImportInfo[];
  calls: ZilCall[];
}

/**
 * Parser for ZIL source code
 */
export class ZilParser {
  private readonly lexer = new ZilLexer();
  private tokens: Token[] = [];
  private pos = 0;

  /**
   * Parse ZIL source code
   */
  parse(input: string): ZilParseResult {
    this.tokens = this.lexer.tokenize(input);
    this.pos = 0;

    const forms: ZilForm[] = [];
    const symbols: ZilSymbol[] = [];
    const imports: ImportInfo[] = [];
    const calls: ZilCall[] = [];

    // Parse all top-level forms
    while (!this.isAtEnd()) {
      if (this.check(TokenType.LANGLE)) {
        const form = this.parseForm();
        if (form !== undefined) {
          forms.push(form);

          // Extract symbols from definition forms
          const symbol = this.extractSymbol(form);
          if (symbol !== undefined) {
            symbols.push(symbol);
          }

          // Extract imports from INSERT-FILE
          const imp = this.extractImport(form);
          if (imp !== undefined) {
            imports.push(imp);
          }

          // Extract calls from routines
          if (form.head.toUpperCase() === 'ROUTINE') {
            const routineName = this.getRoutineName(form);
            if (routineName !== undefined) {
              this.extractCalls(form, routineName, calls);
            }
          }
        }
      } else {
        // Skip non-form tokens at top level
        this.advance();
      }
    }

    return { forms, symbols, imports, calls };
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek()?.type === type;
  }

  private advance(): Token | undefined {
    if (!this.isAtEnd()) {
      const token = this.tokens[this.pos];
      this.pos++;
      return token;
    }
    return undefined;
  }

  private parseForm(): ZilForm | undefined {
    if (!this.check(TokenType.LANGLE)) return undefined;

    const startToken = this.advance(); // consume <
    const startLine = startToken?.line ?? 1;
    let endLine = startLine;

    // Get the head (first element)
    let head = '';
    if (this.check(TokenType.ATOM)) {
      head = this.advance()?.value ?? '';
    }

    const children: ZilNode[] = [];

    // Parse children until >
    while (!this.isAtEnd() && !this.check(TokenType.RANGLE)) {
      const child = this.parseNode();
      if (child !== undefined) {
        children.push(child);
        endLine = this.getNodeEndLine(child);
      } else {
        // Skip unexpected tokens
        this.advance();
      }
    }

    if (this.check(TokenType.RANGLE)) {
      const closeToken = this.advance();
      endLine = closeToken?.line ?? endLine;
    }

    return { head, children, startLine, endLine };
  }

  private parseGroup(): ZilGroup | undefined {
    if (!this.check(TokenType.LPAREN)) return undefined;

    const startToken = this.advance(); // consume (
    const startLine = startToken?.line ?? 1;
    let endLine = startLine;

    const children: ZilNode[] = [];

    while (!this.isAtEnd() && !this.check(TokenType.RPAREN)) {
      const child = this.parseNode();
      if (child !== undefined) {
        children.push(child);
        endLine = this.getNodeEndLine(child);
      } else {
        this.advance();
      }
    }

    if (this.check(TokenType.RPAREN)) {
      const closeToken = this.advance();
      endLine = closeToken?.line ?? endLine;
    }

    return { type: 'group', children, startLine, endLine };
  }

  private parseNode(): ZilNode | undefined {
    const token = this.peek();
    if (token === undefined) return undefined;

    switch (token.type) {
      case TokenType.LANGLE:
        return this.parseForm();
      case TokenType.LPAREN:
        return this.parseGroup();
      case TokenType.ATOM:
        this.advance();
        return { type: 'atom', value: token.value, line: token.line };
      case TokenType.STRING:
        this.advance();
        return { type: 'string', value: token.value, line: token.line };
      case TokenType.NUMBER:
        this.advance();
        return { type: 'number', value: token.value, line: token.line };
      default:
        return undefined;
    }
  }

  private getNodeEndLine(node: ZilNode): number {
    if ('endLine' in node) {
      return node.endLine;
    }
    return node.line;
  }

  private extractSymbol(form: ZilForm): ZilSymbol | undefined {
    const headUpper = form.head.toUpperCase();

    if (!isDefinitionForm(headUpper)) {
      return undefined;
    }

    // Get the name (first child that's an atom)
    const nameNode = form.children.find((c): c is ZilLeaf => 'type' in c && c.type === 'atom');

    if (nameNode === undefined) {
      return undefined;
    }

    const kindMap: Record<string, ZilSymbol['kind']> = {
      ROUTINE: 'routine',
      OBJECT: 'object',
      ROOM: 'room',
      GLOBAL: 'global',
      CONSTANT: 'constant',
      SYNTAX: 'syntax',
      VERB: 'verb',
      DEFINE: 'routine',
      DEFMAC: 'routine',
    };

    const kind = kindMap[headUpper];
    if (kind === undefined) {
      return undefined;
    }

    const result: ZilSymbol = {
      name: nameNode.value,
      kind,
      startLine: form.startLine,
      endLine: form.endLine,
    };

    if (headUpper === 'ROUTINE' || headUpper === 'DEFINE' || headUpper === 'DEFMAC') {
      result.signature = this.extractRoutineSignature(form, nameNode.value);
    }

    return result;
  }

  private extractRoutineSignature(form: ZilForm, name: string): string {
    // Find args group (first parenthesized group after name)
    const argsGroup = form.children.find((c): c is ZilGroup => 'type' in c && c.type === 'group');

    if (argsGroup === undefined) {
      return `ROUTINE ${name} ()`;
    }

    const args = argsGroup.children
      .filter((c): c is ZilLeaf => 'type' in c && c.type === 'atom')
      .map((c) => c.value)
      .join(' ');

    return `ROUTINE ${name} (${args})`;
  }

  private extractImport(form: ZilForm): ImportInfo | undefined {
    if (form.head.toUpperCase() !== 'INSERT-FILE') {
      return undefined;
    }

    // Get the file name (first string child)
    const fileNode = form.children.find((c): c is ZilLeaf => 'type' in c && c.type === 'string');

    if (fileNode === undefined) {
      return undefined;
    }

    return {
      source: fileNode.value,
      specifiers: [],
      isType: false,
    };
  }

  private getRoutineName(form: ZilForm): string | undefined {
    const nameNode = form.children.find((c): c is ZilLeaf => 'type' in c && c.type === 'atom');
    return nameNode?.value;
  }

  private extractCalls(node: ZilNode, caller: string, calls: ZilCall[]): void {
    if ('head' in node) {
      // It's a form
      const headUpper = node.head.toUpperCase();

      // If not a special form and not empty, it's a call
      if (node.head !== '' && !isSpecialForm(headUpper)) {
        calls.push({
          caller,
          callee: node.head,
          line: node.startLine,
        });
      }

      // Recurse into children
      for (const child of node.children) {
        this.extractCalls(child, caller, calls);
      }
    } else if ('type' in node && node.type === 'group') {
      // Recurse into group children
      for (const child of node.children) {
        this.extractCalls(child, caller, calls);
      }
    }
    // Leaf nodes don't contain calls
  }
}
