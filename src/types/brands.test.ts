import { describe, it, expect } from 'vitest';
import { createStoreId, createDocumentId, isStoreId, isDocumentId } from './brands.js';

describe('branded types', () => {
  describe('StoreId', () => {
    it('creates a valid store ID', () => {
      const id = createStoreId('store-123');
      expect(id).toBe('store-123');
    });

    it('validates store ID format', () => {
      expect(isStoreId('valid-store-id')).toBe(true);
      expect(isStoreId('')).toBe(false);
      expect(isStoreId('has spaces')).toBe(false);
    });

    it('throws error for invalid store ID', () => {
      expect(() => createStoreId('invalid id with spaces')).toThrow(
        'Invalid store ID: invalid id with spaces'
      );
    });

    it('throws error for empty store ID', () => {
      expect(() => createStoreId('')).toThrow('Invalid store ID: ');
    });
  });

  describe('DocumentId', () => {
    it('creates a valid document ID', () => {
      const id = createDocumentId('doc-456');
      expect(id).toBe('doc-456');
    });

    it('validates document ID format', () => {
      expect(isDocumentId('valid-doc-id')).toBe(true);
      expect(isDocumentId('')).toBe(false);
    });

    it('throws error for invalid document ID', () => {
      expect(() => createDocumentId('invalid@id')).toThrow('Invalid document ID: invalid@id');
    });

    it('throws error for empty document ID', () => {
      expect(() => createDocumentId('')).toThrow('Invalid document ID: ');
    });
  });
});
