import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

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
    return result.map(v => Number(v));
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  getDimensions(): number {
    return this.dimensions;
  }
}
