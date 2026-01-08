/**
 * Repository Pattern Implementation
 *
 * This module implements the Repository pattern for data access abstraction.
 * It provides a clean interface for CRUD operations independent of the underlying database.
 */

/**
 * Base entity interface - all entities must have an ID
 */
export interface Entity {
  id: string;
}

/**
 * Query options for find operations
 */
export interface QueryOptions<T> {
  where?: Partial<T>;
  orderBy?: {
    field: keyof T;
    direction: 'asc' | 'desc';
  };
  limit?: number;
  offset?: number;
  include?: string[];
}

/**
 * Result of a paginated query
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Generic Repository interface
 * Defines the contract for all repositories
 */
export interface IRepository<T extends Entity> {
  findById(id: string): Promise<T | null>;
  findOne(options: QueryOptions<T>): Promise<T | null>;
  findMany(options?: QueryOptions<T>): Promise<T[]>;
  findPaginated(
    page: number,
    pageSize: number,
    options?: QueryOptions<T>
  ): Promise<PaginatedResult<T>>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(options?: QueryOptions<T>): Promise<number>;
  exists(id: string): Promise<boolean>;
}

/**
 * Base Repository implementation with common functionality
 * Extend this class for specific entity repositories
 */
export abstract class BaseRepository<T extends Entity> implements IRepository<T> {
  protected items: Map<string, T> = new Map();

  /**
   * Generates a unique ID for new entities
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Applies query filters to an array of items
   */
  protected applyFilters(items: T[], options?: QueryOptions<T>): T[] {
    let result = [...items];

    // Apply where filters
    if (options?.where) {
      result = result.filter((item) => {
        return Object.entries(options.where!).every(([key, value]) => {
          return item[key as keyof T] === value;
        });
      });
    }

    // Apply ordering
    if (options?.orderBy) {
      const { field, direction } = options.orderBy;
      result.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    if (options?.offset !== undefined) {
      result = result.slice(options.offset);
    }
    if (options?.limit !== undefined) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) ?? null;
  }

  async findOne(options: QueryOptions<T>): Promise<T | null> {
    const results = await this.findMany({ ...options, limit: 1 });
    return results[0] ?? null;
  }

  async findMany(options?: QueryOptions<T>): Promise<T[]> {
    const allItems = Array.from(this.items.values());
    return this.applyFilters(allItems, options);
  }

  async findPaginated(
    page: number,
    pageSize: number,
    options?: QueryOptions<T>
  ): Promise<PaginatedResult<T>> {
    const allItems = Array.from(this.items.values());
    const filtered = this.applyFilters(allItems, {
      ...options,
      limit: undefined,
      offset: undefined,
    });
    const total = filtered.length;

    const offset = (page - 1) * pageSize;
    const items = filtered.slice(offset, offset + pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async create(data: Omit<T, 'id'>): Promise<T> {
    const id = this.generateId();
    const item = { ...data, id } as T;
    this.items.set(id, item);
    return item;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Entity with id ${id} not found`);
    }

    const updated = { ...existing, ...data, id } as T;
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.items.has(id)) {
      throw new Error(`Entity with id ${id} not found`);
    }
    this.items.delete(id);
  }

  async count(options?: QueryOptions<T>): Promise<number> {
    const items = await this.findMany({ ...options, limit: undefined, offset: undefined });
    return items.length;
  }

  async exists(id: string): Promise<boolean> {
    return this.items.has(id);
  }
}

/**
 * User entity for demonstration
 */
export interface User extends Entity {
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

/**
 * User Repository with user-specific methods
 */
export class UserRepository extends BaseRepository<User> {
  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } as Partial<User> });
  }

  async findAdmins(): Promise<User[]> {
    return this.findMany({ where: { role: 'admin' } as Partial<User> });
  }

  async findRecentUsers(limit: number = 10): Promise<User[]> {
    return this.findMany({
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit,
    });
  }
}

/**
 * Post entity for demonstration
 */
export interface Post extends Entity {
  title: string;
  content: string;
  authorId: string;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Post Repository with post-specific methods
 */
export class PostRepository extends BaseRepository<Post> {
  async findByAuthor(authorId: string): Promise<Post[]> {
    return this.findMany({ where: { authorId } as Partial<Post> });
  }

  async findPublished(): Promise<Post[]> {
    return this.findMany({
      where: { published: true } as Partial<Post>,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  async publish(id: string): Promise<Post> {
    return this.update(id, { published: true, updatedAt: new Date() } as Partial<Post>);
  }

  async unpublish(id: string): Promise<Post> {
    return this.update(id, { published: false, updatedAt: new Date() } as Partial<Post>);
  }
}

/**
 * Unit of Work pattern for coordinating multiple repositories
 */
export class UnitOfWork {
  public readonly users: UserRepository;
  public readonly posts: PostRepository;

  constructor() {
    this.users = new UserRepository();
    this.posts = new PostRepository();
  }

  /**
   * In a real implementation, this would commit a database transaction
   */
  async commit(): Promise<void> {
    // Commit transaction
    console.log('Transaction committed');
  }

  /**
   * In a real implementation, this would rollback a database transaction
   */
  async rollback(): Promise<void> {
    // Rollback transaction
    console.log('Transaction rolled back');
  }
}
