/**
 * OAuth 2.0 Authentication Flow Implementation
 *
 * This module handles OAuth authentication with various providers
 * including Google, GitHub, and generic OAuth 2.0 servers.
 */

import { randomBytes, createHash } from 'crypto';

// OAuth Configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

// OAuth Provider Configurations
export const PROVIDERS: Record<string, Partial<OAuthConfig>> = {
  google: {
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
};

/**
 * OAuth State Management
 * Stores state tokens to prevent CSRF attacks
 */
const stateStore = new Map<string, { expiresAt: number; data: Record<string, unknown> }>();

/**
 * Generates a cryptographically secure state token
 * Used to prevent CSRF attacks during OAuth flow
 */
export function generateState(data: Record<string, unknown> = {}): string {
  const state = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  stateStore.set(state, { expiresAt, data });

  // Clean up expired states
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < Date.now()) {
      stateStore.delete(key);
    }
  }

  return state;
}

/**
 * Validates and consumes a state token
 * @returns The data associated with the state, or null if invalid
 */
export function validateState(state: string): Record<string, unknown> | null {
  const stored = stateStore.get(state);

  if (!stored) {
    return null;
  }

  if (stored.expiresAt < Date.now()) {
    stateStore.delete(state);
    return null;
  }

  stateStore.delete(state);
  return stored.data;
}

/**
 * PKCE Code Verifier and Challenge
 * Implements Proof Key for Code Exchange for added security
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generates PKCE code verifier and challenge
 * Required for public clients (SPAs, mobile apps)
 */
export function generatePKCE(): PKCEPair {
  const codeVerifier = randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return { codeVerifier, codeChallenge };
}

/**
 * Builds the authorization URL for OAuth flow
 */
export function buildAuthorizationUrl(
  config: OAuthConfig,
  options: {
    state?: string;
    codeChallenge?: string;
    prompt?: 'none' | 'consent' | 'select_account';
  } = {}
): string {
  const url = new URL(config.authorizationUrl);

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));

  if (options.state) {
    url.searchParams.set('state', options.state);
  }

  if (options.codeChallenge) {
    url.searchParams.set('code_challenge', options.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }

  if (options.prompt) {
    url.searchParams.set('prompt', options.prompt);
  }

  return url.toString();
}

/**
 * Token Response from OAuth provider
 */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * Exchanges authorization code for tokens
 */
export async function exchangeCodeForTokens(
  config: OAuthConfig,
  code: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });

  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }

  return response.json();
}

/**
 * Fetches user info from OAuth provider
 */
export async function fetchUserInfo(
  config: OAuthConfig,
  accessToken: string
): Promise<Record<string, unknown>> {
  const response = await fetch(config.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Refreshes an access token using a refresh token
 */
export async function refreshAccessToken(
  config: OAuthConfig,
  refreshToken: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  return response.json();
}
