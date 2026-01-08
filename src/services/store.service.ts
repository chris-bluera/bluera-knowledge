import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, stat, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { cloneRepository } from '../plugin/git-clone.js';
import { createStoreId } from '../types/brands.js';
import { ok, err } from '../types/result.js';
import type { StoreId } from '../types/brands.js';
import type { Result } from '../types/result.js';
import type { Store, FileStore, RepoStore, WebStore, StoreType } from '../types/store.js';

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface CreateStoreInput {
  name: string;
  type: StoreType;
  path?: string | undefined;
  url?: string | undefined;
  description?: string | undefined;
  tags?: string[] | undefined;
  branch?: string | undefined;
  depth?: number | undefined;
}

interface StoreRegistry {
  stores: Store[];
}

export class StoreService {
  private readonly dataDir: string;
  private registry: StoreRegistry = { stores: [] };

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await this.loadRegistry();
  }

  async create(input: CreateStoreInput): Promise<Result<Store>> {
    if (!input.name || input.name.trim() === '') {
      return err(new Error('Store name cannot be empty'));
    }

    const existing = await this.getByName(input.name);
    if (existing !== undefined) {
      return err(new Error(`Store with name "${input.name}" already exists`));
    }

    const id = createStoreId(randomUUID());
    const now = new Date();

    let store: Store;

    switch (input.type) {
      case 'file': {
        if (input.path === undefined) {
          return err(new Error('Path is required for file stores'));
        }
        // Normalize path to absolute path (security: prevents path confusion)
        const normalizedPath = resolve(input.path);
        // Validate directory exists
        try {
          const stats = await stat(normalizedPath);
          if (!stats.isDirectory()) {
            return err(new Error(`Path is not a directory: ${normalizedPath}`));
          }
        } catch {
          return err(new Error(`Directory does not exist: ${normalizedPath}`));
        }
        store = {
          type: 'file',
          id,
          name: input.name,
          path: normalizedPath,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies FileStore;
        break;
      }

      case 'repo': {
        let repoPath = input.path;

        // If URL provided, clone it
        if (input.url !== undefined) {
          const cloneDir = join(this.dataDir, 'repos', id);
          const result = await cloneRepository({
            url: input.url,
            targetDir: cloneDir,
            ...(input.branch !== undefined ? { branch: input.branch } : {}),
            depth: input.depth ?? 1,
          });

          if (!result.success) {
            return err(result.error);
          }
          repoPath = result.data;
        }

        if (repoPath === undefined) {
          return err(new Error('Path or URL required for repo stores'));
        }

        // Normalize path to absolute path (security: prevents path confusion)
        const normalizedRepoPath = resolve(repoPath);

        store = {
          type: 'repo',
          id,
          name: input.name,
          path: normalizedRepoPath,
          url: input.url,
          branch: input.branch,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies RepoStore;
        break;
      }

      case 'web':
        if (input.url === undefined) {
          return err(new Error('URL is required for web stores'));
        }
        store = {
          type: 'web',
          id,
          name: input.name,
          url: input.url,
          depth: input.depth ?? 1,
          description: input.description,
          tags: input.tags,
          status: 'ready',
          createdAt: now,
          updatedAt: now,
        } satisfies WebStore;
        break;
    }

    this.registry.stores.push(store);
    await this.saveRegistry();

    return ok(store);
  }

  async list(type?: StoreType): Promise<Store[]> {
    if (type !== undefined) {
      return Promise.resolve(this.registry.stores.filter((s) => s.type === type));
    }
    return Promise.resolve([...this.registry.stores]);
  }

  async get(id: StoreId): Promise<Store | undefined> {
    return Promise.resolve(this.registry.stores.find((s) => s.id === id));
  }

  async getByName(name: string): Promise<Store | undefined> {
    return Promise.resolve(this.registry.stores.find((s) => s.name === name));
  }

  async getByIdOrName(idOrName: string): Promise<Store | undefined> {
    return Promise.resolve(
      this.registry.stores.find((s) => s.id === idOrName || s.name === idOrName)
    );
  }

  async update(
    id: StoreId,
    updates: Partial<Pick<Store, 'name' | 'description' | 'tags'>>
  ): Promise<Result<Store>> {
    const index = this.registry.stores.findIndex((s) => s.id === id);
    if (index === -1) {
      return err(new Error(`Store not found: ${id}`));
    }

    const store = this.registry.stores[index];
    if (store === undefined) {
      return err(new Error(`Store not found: ${id}`));
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const updated = {
      ...store,
      ...updates,
      updatedAt: new Date(),
    } as Store;

    this.registry.stores[index] = updated;
    await this.saveRegistry();

    return ok(updated);
  }

  async delete(id: StoreId): Promise<Result<void>> {
    const index = this.registry.stores.findIndex((s) => s.id === id);
    if (index === -1) {
      return err(new Error(`Store not found: ${id}`));
    }

    this.registry.stores.splice(index, 1);
    await this.saveRegistry();

    return ok(undefined);
  }

  private async loadRegistry(): Promise<void> {
    const registryPath = join(this.dataDir, 'stores.json');
    const exists = await fileExists(registryPath);

    if (!exists) {
      // First run - create empty registry
      this.registry = { stores: [] };
      await this.saveRegistry();
      return;
    }

    // File exists - load it (throws on corruption per CLAUDE.md "fail early")
    const content = await readFile(registryPath, 'utf-8');
    try {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = JSON.parse(content) as { stores: Store[] };
      this.registry = {
        stores: data.stores.map((s) => ({
          ...s,
          id: createStoreId(s.id),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        })),
      };
    } catch (error) {
      throw new Error(
        `Failed to parse store registry at ${registryPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async saveRegistry(): Promise<void> {
    const registryPath = join(this.dataDir, 'stores.json');
    await writeFile(registryPath, JSON.stringify(this.registry, null, 2));
  }
}
