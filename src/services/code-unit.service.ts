export interface CodeUnit {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'documentation' | 'example';
  name: string;
  signature: string;
  fullContent: string;
  startLine: number;
  endLine: number;
  language: string;
}

export class CodeUnitService {
  extractCodeUnit(code: string, symbolName: string, language: string): CodeUnit | undefined {
    const lines = code.split('\n');

    // Find the line containing the symbol
    let startLine = -1;
    let type: CodeUnit['type'] = 'function';

    // NOTE: Now supports function declarations, class declarations, and arrow functions (const/let/var).
    // Does not handle interfaces or type definitions yet.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';

      if (line.includes(`function ${symbolName}`)) {
        startLine = i + 1; // 1-indexed
        type = 'function';
        break;
      }

      if (line.includes(`class ${symbolName}`)) {
        startLine = i + 1;
        type = 'class';
        break;
      }

      // Check for arrow functions: const/let/var name = ...
      if (line.match(new RegExp(`(?:const|let|var)\\s+${symbolName}\\s*=`))) {
        startLine = i + 1;
        type = 'const';
        break;
      }
    }

    if (startLine === -1) return undefined;

    // Find end line using state machine that tracks strings and comments
    let endLine = startLine;
    let braceCount = 0;
    let foundFirstBrace = false;

    // State machine for tracking context
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplateLiteral = false;
    let inMultiLineComment = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i] ?? '';
      let inSingleLineComment = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const prevChar = j > 0 ? line[j - 1] : '';
        const nextChar = j < line.length - 1 ? line[j + 1] : '';

        // Skip escaped characters within strings
        if (prevChar === '\\' && (inSingleQuote || inDoubleQuote || inTemplateLiteral)) {
          continue;
        }

        // Inside multi-line comment - only look for end marker
        if (inMultiLineComment) {
          if (char === '*' && nextChar === '/') {
            inMultiLineComment = false;
            j++; // Skip the /
          }
          continue;
        }

        // Inside single-line comment - skip rest of line
        if (inSingleLineComment) {
          continue;
        }

        // Inside a string - only look for closing delimiter
        if (inSingleQuote) {
          if (char === "'") inSingleQuote = false;
          continue;
        }
        if (inDoubleQuote) {
          if (char === '"') inDoubleQuote = false;
          continue;
        }
        if (inTemplateLiteral) {
          if (char === '`') inTemplateLiteral = false;
          continue;
        }

        // Not inside any special context - check for context starters
        if (char === '/' && nextChar === '*') {
          inMultiLineComment = true;
          j++; // Skip the *
          continue;
        }
        if (char === '/' && nextChar === '/') {
          inSingleLineComment = true;
          continue;
        }
        if (char === "'") {
          inSingleQuote = true;
          continue;
        }
        if (char === '"') {
          inDoubleQuote = true;
          continue;
        }
        if (char === '`') {
          inTemplateLiteral = true;
          continue;
        }

        // Count braces (we're not inside any string or comment)
        if (char === '{') {
          braceCount++;
          foundFirstBrace = true;
        }
        if (char === '}') braceCount--;
      }

      if (foundFirstBrace && braceCount === 0) {
        endLine = i + 1;
        break;
      }
    }

    const fullContent = lines.slice(startLine - 1, endLine).join('\n');

    // Extract signature (first line, cleaned)
    const firstLine = lines[startLine - 1] ?? '';
    const signature = this.extractSignature(firstLine, symbolName, type);

    return {
      type,
      name: symbolName,
      signature,
      fullContent,
      startLine,
      endLine,
      language,
    };
  }

  private extractSignature(line: string, name: string, type: string): string {
    // Remove 'export', 'async', trim whitespace
    const sig = line
      .replace(/^\s*export\s+/, '')
      .replace(/^\s*async\s+/, '')
      .trim();

    if (type === 'function') {
      // Extract just "functionName(params): returnType"
      // Supports: simple types, generics (Promise<T>), arrays (T[]), unions (T | null)
      const match = sig.match(/function\s+(\w+\([^)]*\):\s*[\w<>[\],\s|]+)/);
      if (match?.[1] !== undefined && match[1].length > 0) return match[1].trim();
    }

    if (type === 'class') {
      return `class ${name}`;
    }

    if (type === 'const') {
      // For arrow functions, extract the variable declaration part
      // Example: const myFunc = (param: string): void => ...
      // Returns: const myFunc = (param: string): void
      const arrowMatch = sig.match(
        new RegExp(
          `((?:const|let|var)\\s+${name}\\s*=\\s*(?:async\\s+)?\\([^)]*\\)(?::\\s*[^=]+)?)`
        )
      );
      const matchedSig = arrowMatch?.[1];
      if (matchedSig !== undefined && matchedSig !== '') return matchedSig.trim();

      // Fallback for simple arrow functions without params
      return `const ${name}`;
    }

    return sig;
  }
}
