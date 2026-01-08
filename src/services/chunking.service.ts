export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export interface Chunk {
  content: string;
  chunkIndex: number;
  totalChunks: number;
  startOffset: number;
  endOffset: number;
  /** Section header if this chunk starts a markdown section */
  sectionHeader?: string | undefined;
  /** Function or class name if this chunk contains a code declaration */
  functionName?: string | undefined;
  /** JSDoc/comment summary extracted from this chunk */
  docSummary?: string | undefined;
}

/**
 * Preset configurations for different content types.
 * Code uses smaller chunks for precise symbol matching.
 * Web/docs use larger chunks to preserve prose context.
 */
const CHUNK_PRESETS = {
  code: { chunkSize: 768, chunkOverlap: 100 },
  web: { chunkSize: 1200, chunkOverlap: 200 },
  docs: { chunkSize: 1200, chunkOverlap: 200 },
} as const;

export type ContentType = keyof typeof CHUNK_PRESETS;

export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(config: ChunkConfig) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  /**
   * Create a ChunkingService with preset configuration for a content type.
   * - 'code': Smaller chunks (768/100) for precise code symbol matching
   * - 'web': Larger chunks (1200/200) for web prose content
   * - 'docs': Larger chunks (1200/200) for documentation
   */
  static forContentType(type: ContentType): ChunkingService {
    return new ChunkingService(CHUNK_PRESETS[type]);
  }

  /**
   * Chunk text content. Uses semantic chunking for Markdown and code files,
   * falling back to sliding window for other content.
   */
  chunk(text: string, filePath?: string): Chunk[] {
    // Use semantic chunking for Markdown files
    if (filePath !== undefined && filePath !== '' && /\.md$/i.test(filePath)) {
      return this.chunkMarkdown(text);
    }

    // Use semantic chunking for TypeScript/JavaScript files
    if (filePath !== undefined && filePath !== '' && /\.(ts|tsx|js|jsx)$/i.test(filePath)) {
      return this.chunkCode(text);
    }

    return this.chunkSlidingWindow(text);
  }

  /**
   * Semantic chunking for Markdown files.
   * Splits on section headers to keep related content together.
   */
  private chunkMarkdown(text: string): Chunk[] {
    // Match markdown headers (# through ####)
    const headerRegex = /^(#{1,4})\s+(.+)$/gm;
    const sections: Array<{ header: string; content: string; startOffset: number }> = [];

    let lastIndex = 0;
    let lastHeader = '';
    let match: RegExpExecArray | null;

    while ((match = headerRegex.exec(text)) !== null) {
      // Save previous section
      if (match.index > lastIndex) {
        const content = text.slice(lastIndex, match.index).trim();
        if (content) {
          sections.push({
            header: lastHeader,
            content: content,
            startOffset: lastIndex,
          });
        }
      }
      lastHeader = match[2] ?? '';
      lastIndex = match.index;
    }

    // Add final section
    const finalContent = text.slice(lastIndex).trim();
    if (finalContent) {
      sections.push({
        header: lastHeader,
        content: finalContent,
        startOffset: lastIndex,
      });
    }

    // If no sections found, fall back to sliding window
    if (sections.length === 0) {
      return this.chunkSlidingWindow(text);
    }

    // Convert sections to chunks, splitting large sections if needed
    const chunks: Chunk[] = [];

    for (const section of sections) {
      if (section.content.length <= this.chunkSize) {
        // Section fits in one chunk
        chunks.push({
          content: section.content,
          chunkIndex: chunks.length,
          totalChunks: 0,
          startOffset: section.startOffset,
          endOffset: section.startOffset + section.content.length,
          sectionHeader: section.header || undefined,
        });
      } else {
        // Split large section using sliding window
        const sectionChunks = this.chunkSlidingWindow(section.content);
        for (const subChunk of sectionChunks) {
          chunks.push({
            ...subChunk,
            chunkIndex: chunks.length,
            startOffset: section.startOffset + subChunk.startOffset,
            endOffset: section.startOffset + subChunk.endOffset,
            sectionHeader: section.header || undefined,
          });
        }
      }
    }

    // Set totalChunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Semantic chunking for TypeScript/JavaScript code files.
   * Splits on top-level declarations to keep functions/classes together.
   */
  private chunkCode(text: string): Chunk[] {
    // Match top-level declarations with optional JSDoc/comments before them
    const declarationRegex =
      /^(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+(\w+)/gm;
    const declarations: Array<{ startOffset: number; endOffset: number; name?: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = declarationRegex.exec(text)) !== null) {
      const name = match[1];
      const decl: { startOffset: number; endOffset: number; name?: string } = {
        startOffset: match.index,
        endOffset: match.index,
      };
      if (name !== undefined) {
        decl.name = name;
      }
      declarations.push(decl);
    }

    // If no declarations found, use sliding window
    if (declarations.length === 0) {
      return this.chunkSlidingWindow(text);
    }

    // Find end of each declaration using brace-aware boundary detection
    for (let i = 0; i < declarations.length; i++) {
      const currentDecl = declarations[i];
      const nextDecl = declarations[i + 1];
      if (currentDecl === undefined) continue;

      // For declarations that likely have braces (functions, classes, enums)
      // use smart boundary detection
      const declText = text.slice(currentDecl.startOffset);
      if (
        /^(?:\/\*\*[\s\S]*?\*\/\s*)?(?:export\s+)?(?:async\s+)?(?:function|class|enum)\s+/m.test(
          declText
        )
      ) {
        const boundary = this.findDeclarationEnd(declText);
        if (boundary > 0) {
          currentDecl.endOffset = currentDecl.startOffset + boundary;
        } else {
          // Fall back to next declaration or EOF
          currentDecl.endOffset = nextDecl !== undefined ? nextDecl.startOffset : text.length;
        }
      } else {
        // For other declarations (interface, type, const, let, var), use next declaration or EOF
        currentDecl.endOffset = nextDecl !== undefined ? nextDecl.startOffset : text.length;
      }
    }

    const chunks: Chunk[] = [];

    for (const decl of declarations) {
      const content = text.slice(decl.startOffset, decl.endOffset).trim();

      if (content.length <= this.chunkSize) {
        // Declaration fits in one chunk
        chunks.push({
          content,
          chunkIndex: chunks.length,
          totalChunks: 0,
          startOffset: decl.startOffset,
          endOffset: decl.endOffset,
          functionName: decl.name,
        });
      } else {
        // Split large declaration with sliding window
        const declChunks = this.chunkSlidingWindow(content);
        for (const subChunk of declChunks) {
          chunks.push({
            ...subChunk,
            chunkIndex: chunks.length,
            startOffset: decl.startOffset + subChunk.startOffset,
            endOffset: decl.startOffset + subChunk.endOffset,
            functionName: decl.name,
          });
        }
      }
    }

    // Set totalChunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks.length > 0 ? chunks : this.chunkSlidingWindow(text);
  }

  /**
   * Find the end of a code declaration by counting braces while ignoring
   * braces inside strings and comments.
   * Returns the offset where the declaration ends, or -1 if not found.
   */
  private findDeclarationEnd(text: string): number {
    let braceCount = 0;
    let inString = false;
    let inSingleLineComment = false;
    let inMultiLineComment = false;
    let stringChar = '';
    let i = 0;
    let foundFirstBrace = false;

    // Find the first opening brace
    while (i < text.length) {
      const char = text[i];
      const nextChar = i + 1 < text.length ? text[i + 1] : '';

      // Handle comments
      if (!inString && !inMultiLineComment && char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        i += 2;
        continue;
      }

      if (!inString && !inSingleLineComment && char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i += 2;
        continue;
      }

      if (inMultiLineComment && char === '*' && nextChar === '/') {
        inMultiLineComment = false;
        i += 2;
        continue;
      }

      if (inSingleLineComment && char === '\n') {
        inSingleLineComment = false;
        i++;
        continue;
      }

      // Skip if in comment
      if (inSingleLineComment || inMultiLineComment) {
        i++;
        continue;
      }

      // Handle strings
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        i++;
        continue;
      }

      if (inString && char === '\\') {
        // Skip escaped character
        i += 2;
        continue;
      }

      if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
        i++;
        continue;
      }

      // Skip if in string
      if (inString) {
        i++;
        continue;
      }

      // Count braces
      if (char === '{') {
        braceCount++;
        foundFirstBrace = true;
      } else if (char === '}') {
        braceCount--;
        if (foundFirstBrace && braceCount === 0) {
          // Found the closing brace
          return i + 1;
        }
      }

      i++;
    }

    // If we didn't find a complete declaration, return -1
    return -1;
  }

  /**
   * Traditional sliding window chunking for non-Markdown content.
   */
  private chunkSlidingWindow(text: string): Chunk[] {
    if (text.length <= this.chunkSize) {
      return [
        {
          content: text,
          chunkIndex: 0,
          totalChunks: 1,
          startOffset: 0,
          endOffset: text.length,
        },
      ];
    }

    const chunks: Chunk[] = [];
    const step = this.chunkSize - this.chunkOverlap;
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.chunkSize, text.length);
      chunks.push({
        content: text.slice(start, end),
        chunkIndex: chunks.length,
        totalChunks: 0,
        startOffset: start,
        endOffset: end,
      });
      start += step;
      if (end === text.length) break;
    }

    // Set totalChunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }
}
