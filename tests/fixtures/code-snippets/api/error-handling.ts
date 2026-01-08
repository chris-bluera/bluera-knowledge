/**
 * API Error Handling Module
 *
 * Centralized error handling for REST APIs with custom error classes,
 * middleware, and consistent error response formatting.
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Base API Error class
 * All custom errors should extend this class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(statusCode: number, message: string, code?: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'API_ERROR';
    this.isOperational = isOperational;
    this.timestamp = new Date();

    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for proper instanceof checks
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * 400 Bad Request - Invalid client request
 */
export class BadRequestError extends ApiError {
  public readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(400, message, 'BAD_REQUEST');
    this.fields = fields;
    Object.setPrototypeOf(this, BadRequestError.prototype);
  }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED');
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

/**
 * 403 Forbidden - Insufficient permissions
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Access denied') {
    super(403, message, 'FORBIDDEN');
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends ApiError {
  public readonly resource: string;

  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(404, message, 'NOT_FOUND');
    this.resource = resource;
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 409 Conflict - Resource conflict
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * 422 Unprocessable Entity - Validation error
 */
export class ValidationError extends ApiError {
  public readonly errors: Array<{
    field: string;
    message: string;
    value?: unknown;
  }>;

  constructor(errors: Array<{ field: string; message: string; value?: unknown }>) {
    super(422, 'Validation failed', 'VALIDATION_ERROR');
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(429, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * 500 Internal Server Error
 */
export class InternalError extends ApiError {
  constructor(message = 'Internal server error') {
    super(500, message, 'INTERNAL_ERROR', false);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message = 'Service temporarily unavailable') {
    super(503, message, 'SERVICE_UNAVAILABLE');
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Standard error response format
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Formats an error into a standard response
 */
export function formatErrorResponse(
  error: ApiError,
  req?: Request,
  requestId?: string
): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: error.timestamp.toISOString(),
    },
  };

  if (req) {
    response.error.path = req.path;
  }

  if (requestId) {
    response.error.requestId = requestId;
  }

  // Add additional details for specific error types
  if (error instanceof ValidationError) {
    response.error.details = { validationErrors: error.errors };
  } else if (error instanceof BadRequestError && error.fields) {
    response.error.details = { fields: error.fields };
  } else if (error instanceof RateLimitError) {
    response.error.details = { retryAfter: error.retryAfter };
  }

  return response;
}

/**
 * Express error handling middleware
 * Should be registered last in the middleware chain
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Get request ID if available
  const requestId = req.headers['x-request-id'] as string | undefined;

  // Log the error
  console.error(`[${requestId || 'no-id'}] Error:`, {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known API errors
  if (err instanceof ApiError) {
    const response = formatErrorResponse(err, req, requestId);

    // Add Retry-After header for rate limit errors
    if (err instanceof RateLimitError) {
      res.setHeader('Retry-After', err.retryAfter);
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  const internalError = new InternalError(
    process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  );

  const response = formatErrorResponse(internalError, req, requestId);
  res.status(500).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError('Route', req.path));
}
