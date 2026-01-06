import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, unwrap, unwrapOr } from './result.js';

describe('Result type', () => {
  describe('ok', () => {
    it('creates a success result', () => {
      const result = ok(42);
      expect(isOk(result)).toBe(true);
      expect(isErr(result)).toBe(false);
    });
  });

  describe('err', () => {
    it('creates an error result', () => {
      const result = err(new Error('failed'));
      expect(isErr(result)).toBe(true);
      expect(isOk(result)).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('returns value for success', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('throws for error', () => {
      const result = err(new Error('failed'));
      expect(() => unwrap(result)).toThrow('failed');
    });

    it('throws wrapped error for non-Error error value', () => {
      const result = err('string error message');
      expect(() => unwrap(result)).toThrow('string error message');
    });

    it('converts non-string error to string', () => {
      const result = err(404);
      expect(() => unwrap(result)).toThrow('404');
    });
  });

  describe('unwrapOr', () => {
    it('returns value for success', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('returns default for error', () => {
      const result = err(new Error('failed'));
      expect(unwrapOr(result, 0)).toBe(0);
    });
  });
});
