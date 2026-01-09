/**
 * Adapter Registry
 *
 * Singleton registry for language adapters. Provides lookup by extension
 * or language ID.
 *
 * @example
 * ```typescript
 * // Register an adapter
 * const registry = AdapterRegistry.getInstance();
 * registry.register(zilAdapter);
 *
 * // Look up by extension
 * const adapter = registry.getByExtension('.zil');
 * if (adapter) {
 *   const nodes = adapter.parse(content, filePath);
 * }
 * ```
 */

import type { LanguageAdapter } from './language-adapter.js';

export class AdapterRegistry {
  private static instance: AdapterRegistry | undefined;

  /** Map from languageId to adapter */
  private readonly adaptersByLanguageId = new Map<string, LanguageAdapter>();

  /** Map from extension to adapter */
  private readonly adaptersByExtension = new Map<string, LanguageAdapter>();

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance of the registry.
   */
  static getInstance(): AdapterRegistry {
    AdapterRegistry.instance ??= new AdapterRegistry();
    return AdapterRegistry.instance;
  }

  /**
   * Reset the singleton instance (for testing).
   */
  static resetInstance(): void {
    AdapterRegistry.instance = undefined;
  }

  /**
   * Register a language adapter.
   *
   * @param adapter - The adapter to register
   * @throws If a different adapter with the same extension is already registered
   */
  register(adapter: LanguageAdapter): void {
    // Skip if already registered with same languageId (idempotent)
    if (this.adaptersByLanguageId.has(adapter.languageId)) {
      return;
    }

    // Check for extension conflicts with other adapters
    for (const ext of adapter.extensions) {
      const normalizedExt = this.normalizeExtension(ext);
      const existingAdapter = this.adaptersByExtension.get(normalizedExt);
      if (existingAdapter !== undefined) {
        throw new Error(
          `Extension "${normalizedExt}" is already registered by adapter "${existingAdapter.languageId}"`
        );
      }
    }

    // Register by languageId
    this.adaptersByLanguageId.set(adapter.languageId, adapter);

    // Register by each extension
    for (const ext of adapter.extensions) {
      const normalizedExt = this.normalizeExtension(ext);
      this.adaptersByExtension.set(normalizedExt, adapter);
    }
  }

  /**
   * Unregister a language adapter by its language ID.
   *
   * @param languageId - The language ID to unregister
   * @returns true if the adapter was found and removed, false otherwise
   */
  unregister(languageId: string): boolean {
    const adapter = this.adaptersByLanguageId.get(languageId);
    if (adapter === undefined) {
      return false;
    }

    // Remove from languageId map
    this.adaptersByLanguageId.delete(languageId);

    // Remove from extension map
    for (const ext of adapter.extensions) {
      const normalizedExt = this.normalizeExtension(ext);
      this.adaptersByExtension.delete(normalizedExt);
    }

    return true;
  }

  /**
   * Get an adapter by file extension.
   *
   * @param ext - File extension (with or without leading dot)
   * @returns The adapter if found, undefined otherwise
   */
  getByExtension(ext: string): LanguageAdapter | undefined {
    const normalizedExt = this.normalizeExtension(ext);
    return this.adaptersByExtension.get(normalizedExt);
  }

  /**
   * Get an adapter by language ID.
   *
   * @param languageId - The unique language identifier
   * @returns The adapter if found, undefined otherwise
   */
  getByLanguageId(languageId: string): LanguageAdapter | undefined {
    return this.adaptersByLanguageId.get(languageId);
  }

  /**
   * Get all registered adapters.
   *
   * @returns Array of all registered adapters
   */
  getAllAdapters(): LanguageAdapter[] {
    return Array.from(this.adaptersByLanguageId.values());
  }

  /**
   * Check if an extension is registered.
   *
   * @param ext - File extension (with or without leading dot)
   * @returns true if the extension is registered
   */
  hasExtension(ext: string): boolean {
    const normalizedExt = this.normalizeExtension(ext);
    return this.adaptersByExtension.has(normalizedExt);
  }

  /**
   * Normalize extension to always have a leading dot.
   */
  private normalizeExtension(ext: string): string {
    return ext.startsWith('.') ? ext : `.${ext}`;
  }
}
