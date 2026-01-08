/**
 * Type guard utilities to replace type assertions
 */

import type { AppConfig } from '../types/config.js';
import type { DocumentMetadata } from '../types/document.js';

/**
 * Safely parse JSON with validation
 */
export function parseJSON<T>(json: string, validator: (value: unknown) => value is T): T {
  const parsed: unknown = JSON.parse(json);
  if (!validator(parsed)) {
    throw new Error('Invalid JSON structure');
  }
  return parsed;
}

/**
 * Type guard for DocumentMetadata
 */
export function isDocumentMetadata(value: unknown): value is DocumentMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['storeId'] === 'string' &&
    typeof obj['path'] === 'string' &&
    typeof obj['docType'] === 'string'
  );
}

/**
 * Type guard for AppConfig
 */
export function isPartialAppConfig(value: unknown): value is Partial<AppConfig> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  // Allow partial config - will be merged with defaults
  return true;
}

/**
 * Type guard for Float32Array-like data
 */
export function isFloat32ArrayData(value: unknown): value is Float32Array {
  return value instanceof Float32Array;
}

/**
 * Check if value is a valid module export that might have a default property
 */
export function hasDefaultExport(value: unknown): value is { default: unknown } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return 'default' in value;
}
