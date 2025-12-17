/**
 * REST API Controller Pattern
 *
 * This module demonstrates a clean REST controller implementation
 * with proper routing, validation, and response formatting.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, NotFoundError, ValidationError, BadRequestError } from './error-handling';
import { authenticateToken, requireRoles } from '../auth/jwt-auth';

/**
 * User entity interface
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Single item response wrapper
 */
export interface SingleResponse<T> {
  success: true;
  data: T;
}

/**
 * Zod schema for user creation
 */
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'user', 'guest']).default('user'),
});

/**
 * Zod schema for user update
 */
const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  role: z.enum(['admin', 'user', 'guest']).optional(),
});

/**
 * Zod schema for pagination query params
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Validates request body against a Zod schema
 */
function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    }));
    throw new ValidationError(errors);
  }

  return result.data;
}

/**
 * Mock user database (replace with actual database in production)
 */
const users: Map<string, User> = new Map();

/**
 * User Controller Class
 * Handles all user-related HTTP endpoints
 */
export class UserController {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Public routes
    this.router.get('/', asyncHandler(this.getUsers.bind(this)));
    this.router.get('/:id', asyncHandler(this.getUserById.bind(this)));

    // Protected routes
    this.router.post(
      '/',
      authenticateToken,
      requireRoles('admin'),
      asyncHandler(this.createUser.bind(this))
    );

    this.router.put(
      '/:id',
      authenticateToken,
      asyncHandler(this.updateUser.bind(this))
    );

    this.router.delete(
      '/:id',
      authenticateToken,
      requireRoles('admin'),
      asyncHandler(this.deleteUser.bind(this))
    );
  }

  /**
   * GET /users
   * List all users with pagination
   */
  private async getUsers(req: Request, res: Response): Promise<void> {
    const pagination = validateBody(paginationSchema, req.query);

    // Convert map to array and apply pagination
    const allUsers = Array.from(users.values());
    const total = allUsers.length;

    // Sort
    allUsers.sort((a, b) => {
      const aValue = a[pagination.sortBy as keyof User];
      const bValue = b[pagination.sortBy as keyof User];

      if (aValue < bValue) return pagination.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return pagination.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Paginate
    const start = (pagination.page - 1) * pagination.limit;
    const paginatedUsers = allUsers.slice(start, start + pagination.limit);

    const totalPages = Math.ceil(total / pagination.limit);

    const response: PaginatedResponse<User> = {
      success: true,
      data: paginatedUsers,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      },
    };

    res.json(response);
  }

  /**
   * GET /users/:id
   * Get a single user by ID
   */
  private async getUserById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const user = users.get(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    const response: SingleResponse<User> = {
      success: true,
      data: user,
    };

    res.json(response);
  }

  /**
   * POST /users
   * Create a new user
   */
  private async createUser(req: Request, res: Response): Promise<void> {
    const data = validateBody(createUserSchema, req.body);

    // Check for existing user
    const existingUser = Array.from(users.values()).find(
      u => u.email === data.email
    );

    if (existingUser) {
      throw new BadRequestError('User with this email already exists', {
        email: 'Email is already taken',
      });
    }

    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      role: data.role,
      createdAt: now,
      updatedAt: now,
    };

    users.set(user.id, user);

    const response: SingleResponse<User> = {
      success: true,
      data: user,
    };

    res.status(201).json(response);
  }

  /**
   * PUT /users/:id
   * Update an existing user
   */
  private async updateUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const data = validateBody(updateUserSchema, req.body);

    const user = users.get(id);

    if (!user) {
      throw new NotFoundError('User', id);
    }

    // Check if user can update this user (admin or self)
    if (req.user?.userId !== id && !req.user?.roles.includes('admin')) {
      throw new BadRequestError('Cannot update other users');
    }

    const updatedUser: User = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };

    users.set(id, updatedUser);

    const response: SingleResponse<User> = {
      success: true,
      data: updatedUser,
    };

    res.json(response);
  }

  /**
   * DELETE /users/:id
   * Delete a user
   */
  private async deleteUser(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!users.has(id)) {
      throw new NotFoundError('User', id);
    }

    users.delete(id);

    res.status(204).send();
  }
}

// Export router instance
export const userRouter = new UserController().router;
