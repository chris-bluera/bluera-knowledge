import { homedir } from 'node:os';
import { join } from 'node:path';
import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Set cache directory to ~/.cache/huggingface-transformers (outside node_modules)
// This allows CI caching and prevents model re-downloads on each npm install
env.cacheDir = join(homedir(), '.cache', 'huggingface-transformers');

export class EmbeddingEngine {
  private extractor: FeatureExtractionPipeline | null = null;
  private readonly modelName: string;
  private readonly dimensions: number;

  constructor(modelName = 'Xenova/all-MiniLM-L6-v2', dimensions = 384) {
    this.modelName = modelName;
    this.dimensions = dimensions;
  }

  async initialize(): Promise<void> {
    if (this.extractor !== null) return;
    // @ts-expect-error TS2590: TypeScript can't represent the complex union type from pipeline()
    // This is a known limitation with @huggingface/transformers overloaded signatures
    this.extractor = await pipeline('feature-extraction', this.modelName, {
      dtype: 'fp32',
    });
  }

  async embed(text: string): Promise<number[]> {
    if (this.extractor === null) {
      await this.initialize();
    }
    if (this.extractor === null) {
      throw new Error('Failed to initialize embedding model');
    }
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    const result = Array.from(output.data);
    return result.map((v) => Number(v));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const BATCH_SIZE = 32; // Process 32 chunks in parallel
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);

      // Process batch in parallel using Promise.all
      const batchResults = await Promise.all(batch.map((text) => this.embed(text)));

      results.push(...batchResults);

      // Small delay between batches to prevent memory issues
      if (i + BATCH_SIZE < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
