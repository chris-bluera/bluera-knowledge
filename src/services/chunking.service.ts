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
   * Chunk text content. Uses semantic chunking for Markdown,
   * falling back to sliding window for other content.
   */
  chunk(text: string, filePath?: string): Chunk[] {
    // Use semantic chunking for Markdown files
    if (filePath && /\.md$/i.test(filePath)) {
      return this.chunkMarkdown(text);
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
