import { describe, it, expect, beforeAll } from 'vitest';
import { EmbeddingEngine } from './embeddings.js';

describe('EmbeddingEngine', () => {
  let engine: EmbeddingEngine;

  beforeAll(async () => {
    engine = new EmbeddingEngine();
    await engine.initialize();
  }, 60000); // Allow time for model download

  it('generates embeddings for text', async () => {
    const embedding = await engine.embed('Hello world');
    expect(embedding).toHaveLength(384);
    expect(embedding.every((n) => typeof n === 'number')).toBe(true);
  });

  it('generates batch embeddings', async () => {
    const texts = ['Hello', 'World', 'Test'];
    const embeddings = await engine.embedBatch(texts);
    expect(embeddings).toHaveLength(3);
    expect(embeddings.every((e) => e.length === 384)).toBe(true);
  });

  it('produces similar embeddings for similar text', async () => {
    const emb1 = await engine.embed('The cat sat on the mat');
    const emb2 = await engine.embed('A cat was sitting on a rug');
    const emb3 = await engine.embed('Quantum physics is complex');

    const sim12 = cosineSimilarity(emb1, emb2);
    const sim13 = cosineSimilarity(emb1, emb3);

    expect(sim12).toBeGreaterThan(sim13);
  });

  it('returns correct dimensions', async () => {
    expect(engine.getDimensions()).toBe(384);
  });

  it('handles embed when extractor is not initialized', async () => {
    // Create new engine without initializing
    const newEngine = new EmbeddingEngine();
    const embedding = await newEngine.embed('Test');
    expect(embedding).toHaveLength(384);
  });

  it('supports custom model dimensions', async () => {
    const customEngine = new EmbeddingEngine('Xenova/all-MiniLM-L6-v2', 512);
    expect(customEngine.getDimensions()).toBe(512);
  });

  it('skips initialization when already initialized', async () => {
    // Engine is already initialized from beforeAll
    // Calling initialize again should be a no-op
    await engine.initialize();
    const embedding = await engine.embed('test');
    expect(embedding).toHaveLength(384);
  });

  it('handles large batch with multiple chunks', async () => {
    // Create enough texts to trigger multiple batch iterations (BATCH_SIZE = 32)
    const texts = Array.from({ length: 40 }, (_, i) => `Text number ${String(i)}`);
    const embeddings = await engine.embedBatch(texts);
    expect(embeddings).toHaveLength(40);
    expect(embeddings.every((e) => e.length === 384)).toBe(true);
  }, 60000);
});

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
