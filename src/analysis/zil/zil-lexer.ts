/**
 * ZIL Lexer
 *
 * Tokenizes ZIL (Zork Implementation Language) source code.
 * ZIL is a Lisp-like language with angle brackets for forms instead of parentheses.
 *
 * Key syntax:
 * - Forms: <FORM arg1 arg2 ...>
 * - Strings: "text"
 * - Numbers: 42, -10
 * - Atoms: ROUTINE, V-LOOK, EQUAL?
 * - Comments: ; line comment
 * - Global refs: ,FOO
 * - Local refs: .BAR
 */

export enum TokenType {
  LANGLE = 'LANGLE', // <
  RANGLE = 'RANGLE', // >
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  ATOM = 'ATOM', // Symbols/identifiers
  STRING = 'STRING', // "text"
  NUMBER = 'NUMBER', // 42, -10
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Lexer for ZIL source code
 */
export class ZilLexer {
  private input = '';
  private pos = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];

  /**
   * Tokenize ZIL source code
   *
   * @param input - Source code string
   * @returns Array of tokens
   * @throws On unterminated strings
   */
  tokenize(input: string): Token[] {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];

    while (!this.isAtEnd()) {
      this.scanToken();
    }

    return this.tokens;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.input.length;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.input[this.pos] ?? '\0';
  }

  private advance(): string {
    const char = this.input[this.pos] ?? '\0';
    this.pos++;

    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }

    return char;
  }

  private addToken(type: TokenType, value: string, startLine: number, startColumn: number): void {
    this.tokens.push({
      type,
      value,
      line: startLine,
      column: startColumn,
    });
  }

  private scanToken(): void {
    const startLine = this.line;
    const startColumn = this.column;
    const char = this.advance();

    switch (char) {
      case '<':
        this.addToken(TokenType.LANGLE, '<', startLine, startColumn);
        break;
      case '>':
        this.addToken(TokenType.RANGLE, '>', startLine, startColumn);
        break;
      case '(':
        this.addToken(TokenType.LPAREN, '(', startLine, startColumn);
        break;
      case ')':
        this.addToken(TokenType.RPAREN, ')', startLine, startColumn);
        break;
      case '"':
        this.scanString(startLine, startColumn);
        break;
      case ';':
        this.skipComment();
        break;
      case ' ':
      case '\t':
      case '\r':
      case '\n':
        // Skip whitespace
        break;
      default:
        if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek()))) {
          this.scanNumber(char, startLine, startColumn);
        } else if (this.isAtomStart(char)) {
          this.scanAtom(char, startLine, startColumn);
        }
        // Ignore other characters
        break;
    }
  }

  private scanString(startLine: number, startColumn: number): void {
    let value = '';

    while (!this.isAtEnd() && this.peek() !== '"') {
      const char = this.peek();

      if (char === '\\') {
        this.advance(); // consume backslash
        const escaped = this.advance();
        switch (escaped) {
          case '"':
            value += '"';
            break;
          case '\\':
            value += '\\';
            break;
          case 'n':
            value += '\n';
            break;
          case 't':
            value += '\t';
            break;
          default:
            value += escaped;
            break;
        }
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new Error(
        `Unterminated string at line ${String(startLine)}, column ${String(startColumn)}`
      );
    }

    // Consume closing quote
    this.advance();

    this.addToken(TokenType.STRING, value, startLine, startColumn);
  }

  private scanNumber(firstChar: string, startLine: number, startColumn: number): void {
    let value = firstChar;

    while (this.isDigit(this.peek())) {
      value += this.advance();
    }

    this.addToken(TokenType.NUMBER, value, startLine, startColumn);
  }

  private scanAtom(firstChar: string, startLine: number, startColumn: number): void {
    let value = firstChar;

    while (this.isAtomChar(this.peek())) {
      value += this.advance();
    }

    this.addToken(TokenType.ATOM, value, startLine, startColumn);
  }

  private skipComment(): void {
    // Skip until end of line
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAtomStart(char: string): boolean {
    return (
      (char >= 'A' && char <= 'Z') ||
      (char >= 'a' && char <= 'z') ||
      char === '_' ||
      char === ',' || // Global reference prefix
      char === '.' || // Local reference prefix
      char === '%' || // Sometimes used in ZIL
      char === '#' // Hash prefix
    );
  }

  private isAtomChar(char: string): boolean {
    return (
      (char >= 'A' && char <= 'Z') ||
      (char >= 'a' && char <= 'z') ||
      (char >= '0' && char <= '9') ||
      char === '_' ||
      char === '-' ||
      char === '?' ||
      char === '!' ||
      char === ',' ||
      char === '.' ||
      char === '%' ||
      char === '#'
    );
  }
}
