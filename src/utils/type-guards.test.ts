import { describe, it, expect } from 'vitest';
import {
  parseJSON,
  isDocumentMetadata,
  isPartialAppConfig,
  isFloat32ArrayData,
  hasDefaultExport,
} from './type-guards.js';
import type { DocumentMetadata } from '../types/document.js';

describe('TypeGuards - parseJSON', () => {
  it('parses valid JSON with validator', () => {
    const validator = (value: unknown): value is { name: string } => {
      return typeof value === 'object' && value !== null && 'name' in value;
    };

    const result = parseJSON('{"name":"test"}', validator);

    expect(result).toEqual({ name: 'test' });
  });

  it('throws on invalid JSON structure', () => {
    const validator = (value: unknown): value is { name: string } => {
      return (
        typeof value === 'object' &&
        value !== null &&
        'name' in value &&
        typeof (value as any).name === 'string'
      );
    };

    expect(() => {
      parseJSON('{"age":25}', validator);
    }).toThrow('Invalid JSON structure');
  });

  it('throws on malformed JSON', () => {
    const validator = (value: unknown): value is object => true;

    expect(() => {
      parseJSON('{ invalid json }', validator);
    }).toThrow();
  });

  it('handles arrays with validator', () => {
    const validator = (value: unknown): value is string[] => {
      return Array.isArray(value) && value.every((v) => typeof v === 'string');
    };

    const result = parseJSON('["a","b","c"]', validator);

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('handles numbers with validator', () => {
    const validator = (value: unknown): value is number => {
      return typeof value === 'number';
    };

    const result = parseJSON('42', validator);

    expect(result).toBe(42);
  });

  it('rejects when validator returns false', () => {
    const strictValidator = (value: unknown): value is { required: string } => {
      return (
        typeof value === 'object' &&
        value !== null &&
        'required' in value &&
        typeof (value as any).required === 'string' &&
        (value as any).required.length > 0
      );
    };

    expect(() => {
      parseJSON('{"required":""}', strictValidator);
    }).toThrow('Invalid JSON structure');
  });
});

describe('TypeGuards - isDocumentMetadata', () => {
  it('returns true for valid DocumentMetadata', () => {
    const metadata: DocumentMetadata = {
      storeId: 'store-123',
      path: '/path/to/file.ts',
      docType: 'code',
    };

    expect(isDocumentMetadata(metadata)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isDocumentMetadata(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDocumentMetadata(undefined)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(isDocumentMetadata('string')).toBe(false);
    expect(isDocumentMetadata(123)).toBe(false);
    expect(isDocumentMetadata(true)).toBe(false);
  });

  it('returns false when missing required storeId', () => {
    const invalid = {
      path: '/path/to/file.ts',
      docType: 'code',
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns false when missing required path', () => {
    const invalid = {
      storeId: 'store-123',
      docType: 'code',
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns false when missing required docType', () => {
    const invalid = {
      storeId: 'store-123',
      path: '/path/to/file.ts',
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns false when storeId is not a string', () => {
    const invalid = {
      storeId: 123,
      path: '/path/to/file.ts',
      docType: 'code',
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns false when path is not a string', () => {
    const invalid = {
      storeId: 'store-123',
      path: 123,
      docType: 'code',
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns false when docType is not a string', () => {
    const invalid = {
      storeId: 'store-123',
      path: '/path/to/file.ts',
      docType: 123,
    };

    expect(isDocumentMetadata(invalid)).toBe(false);
  });

  it('returns true with extra properties', () => {
    const metadata = {
      storeId: 'store-123',
      path: '/path/to/file.ts',
      docType: 'code',
      extraProp: 'allowed',
    };

    expect(isDocumentMetadata(metadata)).toBe(true);
  });
});

describe('TypeGuards - isPartialAppConfig', () => {
  it('returns true for valid partial config', () => {
    const config = {
      port: 3000,
      host: 'localhost',
    };

    expect(isPartialAppConfig(config)).toBe(true);
  });

  it('returns true for empty object', () => {
    expect(isPartialAppConfig({})).toBe(true);
  });

  it('returns false for null', () => {
    expect(isPartialAppConfig(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPartialAppConfig(undefined)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(isPartialAppConfig('string')).toBe(false);
    expect(isPartialAppConfig(123)).toBe(false);
    expect(isPartialAppConfig(true)).toBe(false);
  });

  it('returns true for object with any properties', () => {
    const config = {
      anyProp: 'value',
      anotherProp: 123,
    };

    expect(isPartialAppConfig(config)).toBe(true);
  });
});

describe('TypeGuards - isFloat32ArrayData', () => {
  it('returns true for Float32Array instance', () => {
    const data = new Float32Array([1.0, 2.0, 3.0]);

    expect(isFloat32ArrayData(data)).toBe(true);
  });

  it('returns false for regular array', () => {
    const data = [1.0, 2.0, 3.0];

    expect(isFloat32ArrayData(data)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFloat32ArrayData(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFloat32ArrayData(undefined)).toBe(false);
  });

  it('returns false for objects', () => {
    const obj = { 0: 1.0, 1: 2.0, length: 2 };

    expect(isFloat32ArrayData(obj)).toBe(false);
  });

  it('returns false for other typed arrays', () => {
    const int32 = new Int32Array([1, 2, 3]);
    const uint8 = new Uint8Array([1, 2, 3]);

    expect(isFloat32ArrayData(int32)).toBe(false);
    expect(isFloat32ArrayData(uint8)).toBe(false);
  });

  it('returns true for empty Float32Array', () => {
    const data = new Float32Array();

    expect(isFloat32ArrayData(data)).toBe(true);
  });
});

describe('TypeGuards - hasDefaultExport', () => {
  it('returns true for object with default property', () => {
    const module = { default: 'value' };

    expect(hasDefaultExport(module)).toBe(true);
  });

  it('returns true when default is a function', () => {
    const module = { default: () => {} };

    expect(hasDefaultExport(module)).toBe(true);
  });

  it('returns true when default is null', () => {
    const module = { default: null };

    expect(hasDefaultExport(module)).toBe(true);
  });

  it('returns true when default is undefined', () => {
    const module = { default: undefined };

    expect(hasDefaultExport(module)).toBe(true);
  });

  it('returns false when default property is missing', () => {
    const module = { other: 'value' };

    expect(hasDefaultExport(module)).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasDefaultExport(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasDefaultExport(undefined)).toBe(false);
  });

  it('returns false for non-object types', () => {
    expect(hasDefaultExport('string')).toBe(false);
    expect(hasDefaultExport(123)).toBe(false);
    expect(hasDefaultExport(true)).toBe(false);
  });

  it('returns true for object with default and other properties', () => {
    const module = {
      default: 'value',
      named: 'export',
    };

    expect(hasDefaultExport(module)).toBe(true);
  });
});

describe('TypeGuards - Type Narrowing', () => {
  it('narrows type after isDocumentMetadata check', () => {
    const data: unknown = {
      storeId: 'store-123',
      path: '/file.ts',
      docType: 'code',
    };

    if (isDocumentMetadata(data)) {
      // TypeScript should know data is DocumentMetadata here
      expect(data.storeId).toBe('store-123');
      expect(data.path).toBe('/file.ts');
      expect(data.docType).toBe('code');
    } else {
      throw new Error('Should be DocumentMetadata');
    }
  });

  it('narrows type after isFloat32ArrayData check', () => {
    const data: unknown = new Float32Array([1.0, 2.0, 3.0]);

    if (isFloat32ArrayData(data)) {
      // TypeScript should know data is Float32Array here
      expect(data.length).toBe(3);
      expect(data[0]).toBe(1.0);
    } else {
      throw new Error('Should be Float32Array');
    }
  });

  it('narrows type after hasDefaultExport check', () => {
    const module: unknown = { default: 'test' };

    if (hasDefaultExport(module)) {
      // TypeScript should know module has default property
      expect(module.default).toBe('test');
    } else {
      throw new Error('Should have default export');
    }
  });
});
