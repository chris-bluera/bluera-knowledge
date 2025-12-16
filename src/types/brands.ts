// Branded type symbols
declare const StoreIdBrand: unique symbol;
declare const DocumentIdBrand: unique symbol;

// Branded types
export type StoreId = string & { readonly [StoreIdBrand]: typeof StoreIdBrand };
export type DocumentId = string & { readonly [DocumentIdBrand]: typeof DocumentIdBrand };

// Valid ID pattern: alphanumeric, hyphens, underscores
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function isStoreId(value: string): value is StoreId {
  return value.length > 0 && ID_PATTERN.test(value);
}

export function isDocumentId(value: string): value is DocumentId {
  return value.length > 0 && ID_PATTERN.test(value);
}

export function createStoreId(value: string): StoreId {
  if (!isStoreId(value)) {
    throw new Error(`Invalid store ID: ${value}`);
  }
  return value;
}

export function createDocumentId(value: string): DocumentId {
  if (!isDocumentId(value)) {
    throw new Error(`Invalid document ID: ${value}`);
  }
  return value;
}
