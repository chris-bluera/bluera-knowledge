/**
 * JWT Authentication Module
 *
 * This module provides JWT-based authentication for Express applications.
 * It handles token generation, verification, and middleware for protected routes.
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes } from 'crypto';

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * JWT Payload interface
 */
export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * Token pair returned after authentication
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Extend Express Request to include user information
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Generates an access token for the given user
 * @param user - User object containing id, email, and roles
 * @returns JWT access token
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  roles: string[];
}): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    roles: user.roles,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Generates a refresh token for the given user ID
 * @param userId - User's unique identifier
 * @returns JWT refresh token
 */
export function generateRefreshToken(userId: string): string {
  const tokenId = randomBytes(16).toString('hex');

  return jwt.sign(
    { userId, tokenId },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

/**
 * Generates both access and refresh tokens
 * @param user - User object
 * @returns Token pair with access token, refresh token, and expiry time
 */
export function generateTokenPair(user: {
  id: string;
  email: string;
  roles: string[];
}): TokenPair {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user.id),
    expiresIn: 900, // 15 minutes in seconds
  };
}

/**
 * Verifies an access token and returns the payload
 * @param token - JWT access token to verify
 * @returns Decoded JWT payload
 * @throws Error if token is invalid or expired
 */
export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verifies a refresh token and returns the user ID
 * @param token - JWT refresh token to verify
 * @returns User ID from the token
 */
export function verifyRefreshToken(token: string): { userId: string; tokenId: string } {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { userId: string; tokenId: string };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}

/**
 * Express middleware to authenticate requests using JWT
 * Extracts the token from the Authorization header (Bearer scheme)
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      error: 'Access token required',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(403).json({
      error: error instanceof Error ? error.message : 'Token verification failed',
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Express middleware to check if user has required roles
 * @param requiredRoles - Array of role names that are allowed
 */
export function requireRoles(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const hasRole = req.user.roles.some(role => requiredRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        requiredRoles,
        userRoles: req.user.roles,
      });
      return;
    }

    next();
  };
}

/**
 * Hashes a password using SHA-256 with salt
 * Note: In production, use bcrypt or argon2 instead
 */
export function hashPassword(password: string, salt: string): string {
  return createHash('sha256')
    .update(password + salt)
    .digest('hex');
}

/**
 * Generates a random salt for password hashing
 */
export function generateSalt(): string {
  return randomBytes(16).toString('hex');
}
