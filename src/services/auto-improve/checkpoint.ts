import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Checkpoint, CheckpointFile, Scores, IndexState } from './types.js';

/**
 * Manages checkpoints for the auto-improve feature.
 * Checkpoints store file contents and scores before changes are applied,
 * enabling rollback if quality degrades.
 */
export class CheckpointService {
  private checkpointDir: string;

  constructor(checkpointDir: string) {
    this.checkpointDir = checkpointDir;
    if (!existsSync(checkpointDir)) {
      mkdirSync(checkpointDir, { recursive: true });
    }
  }

  /**
   * Creates a new checkpoint with the current state of the specified files.
   */
  async create(
    filePaths: string[],
    baselineScores: Scores,
    indexState: IndexState
  ): Promise<Checkpoint> {
    const files: CheckpointFile[] = [];

    for (const filePath of filePaths) {
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      files.push({
        path: filePath,
        content: readFileSync(filePath, 'utf-8'),
      });
    }

    const checkpoint: Checkpoint = {
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      baselineScores,
      files,
      indexState,
    };

    this.save(checkpoint);
    return checkpoint;
  }

  /**
   * Lists all checkpoints, sorted by creation time (newest first).
   */
  async list(): Promise<Checkpoint[]> {
    if (!existsSync(this.checkpointDir)) {
      return [];
    }

    const files = readdirSync(this.checkpointDir)
      .filter(f => f.endsWith('.json'));

    const checkpoints: Checkpoint[] = [];
    for (const file of files) {
      const checkpoint = this.load(file.replace('.json', ''));
      if (checkpoint !== undefined) {
        checkpoints.push(checkpoint);
      }
    }

    return checkpoints.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Gets a checkpoint by ID.
   */
  async get(id: string): Promise<Checkpoint | undefined> {
    return this.load(id);
  }

  /**
   * Restores files to their checkpointed state.
   */
  async restore(id: string): Promise<void> {
    const checkpoint = this.load(id);
    if (checkpoint === undefined) {
      throw new Error(`Checkpoint not found: ${id}`);
    }

    for (const file of checkpoint.files) {
      writeFileSync(file.path, file.content, 'utf-8');
    }
  }

  /**
   * Deletes a checkpoint.
   */
  async delete(id: string): Promise<void> {
    const filePath = join(this.checkpointDir, `${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  /**
   * Removes checkpoints older than the specified age (in milliseconds).
   */
  async cleanup(maxAgeMs: number): Promise<void> {
    const checkpoints = await this.list();
    const cutoff = Date.now() - maxAgeMs;

    for (const checkpoint of checkpoints) {
      if (new Date(checkpoint.createdAt).getTime() < cutoff) {
        await this.delete(checkpoint.id);
      }
    }
  }

  private generateId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const random = Math.random().toString(36).substring(2, 8);
    return `checkpoint-${timestamp}-${random}`;
  }

  private save(checkpoint: Checkpoint): void {
    const filePath = join(this.checkpointDir, `${checkpoint.id}.json`);
    writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf-8');
  }

  private load(id: string): Checkpoint | undefined {
    const filePath = join(this.checkpointDir, `${id}.json`);
    if (!existsSync(filePath)) {
      return undefined;
    }
    return JSON.parse(readFileSync(filePath, 'utf-8')) as Checkpoint;
  }
}
