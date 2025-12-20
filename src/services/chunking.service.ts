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
  sectionHeader?: string;
}

export class ChunkingService {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(config: ChunkConfig) {
    this.chunkSize = config.chunkSize;
    this.chunkOverlap = config.chunkOverlap;
  }

  /**
   * Chunk text content. Uses semantic chunking for Markdown and code files,
   * falling back to sliding window for other content.
   */
  chunk(text: string, filePath?: string): Chunk[] {
    // Use semantic chunking for Markdown files
    if (filePath && /\.md$/i.test(filePath)) {
      return this.chunkMarkdown(text);
    }

    // Use semantic chunking for TypeScript/JavaScript files
    if (filePath && /\.(ts|tsx|js|jsx)$/i.test(filePath)) {
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
      if (match.index > lastIndex || sections.length === 0) {
        const content = text.slice(lastIndex, match.index).trim();
        if (content || sections.length === 0) {
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

    // If no sections found (no headers), fall back to sliding window
    if (sections.length <= 1) {
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
            sectionHeader: subChunk.chunkIndex === 0 ? section.header || undefined : undefined,
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
    // Match top-level declarations: export/function/class/interface/type/const/let/var
    const declarationRegex = /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|var|enum)\s+\w+/gm;
    const declarations: Array<{ startOffset: number; endOffset: number }> = [];
    
    let match: RegExpExecArray | null;
    while ((match = declarationRegex.exec(text)) !== null) {
      declarations.push({ startOffset: match.index, endOffset: match.index });
    }

    // If no declarations found or only one, use sliding window
    if (declarations.length <= 1) {
      return this.chunkSlidingWindow(text);
    }

    // Find end of each declaration (next declaration or EOF)
    for (let i = 0; i < declarations.length; i++) {
      const nextStart = i < declarations.length - 1 ? declarations[i + 1]!.startOffset : text.length;
      declarations[i]!.endOffset = nextStart;
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
   * Traditional sliding window chunking for non-Markdown content.
   */
  private chunkSlidingWindow(text: string): Chunk[] {
    if (text.length <= this.chunkSize) {
      return [{
        content: text,
        chunkIndex: 0,
        totalChunks: 1,
        startOffset: 0,
        endOffset: text.length,
      }];
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
