/**
 * Fixture Loader Utilities
 *
 * Helpers for loading test fixtures from the tests/fixtures directory.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Base path for all fixtures
 */
export const FIXTURES_DIR = join(__dirname, '..', 'fixtures');

/**
 * Fixture metadata
 */
export interface Fixture {
  /** Relative path from fixtures directory */
  path: string;
  /** Full absolute path */
  absolutePath: string;
  /** File name without directory */
  filename: string;
  /** File extension */
  extension: string;
  /** File content as string */
  content: string;
  /** File size in bytes */
  size: number;
}

/**
 * Load a single fixture by relative path
 *
 * @param relativePath - Path relative to tests/fixtures/
 * @returns Fixture object with content and metadata
 *
 * @example
 * const readme = await loadFixture('github-readmes/typescript.md');
 */
export async function loadFixture(relativePath: string): Promise<Fixture> {
  const absolutePath = join(FIXTURES_DIR, relativePath);
  const content = await readFile(absolutePath, 'utf-8');
  const stats = await stat(absolutePath);

  return {
    path: relativePath,
    absolutePath,
    filename: relativePath.split('/').pop() || relativePath,
    extension: extname(relativePath),
    content,
    size: stats.size,
  };
}

/**
 * Load all fixtures from a subdirectory
 *
 * @param subdir - Subdirectory within tests/fixtures/
 * @param recursive - Whether to load files recursively (default: true)
 * @returns Array of fixture objects
 *
 * @example
 * const readmes = await loadAllFixtures('github-readmes');
 * const allCode = await loadAllFixtures('code-snippets', true);
 */
export async function loadAllFixtures(
  subdir: string,
  recursive = true
): Promise<Fixture[]> {
  const fixtures: Fixture[] = [];
  const basePath = join(FIXTURES_DIR, subdir);

  async function walkDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory() && recursive) {
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        const relativePath = relative(FIXTURES_DIR, fullPath);
        const fixture = await loadFixture(relativePath);
        fixtures.push(fixture);
      }
    }
  }

  await walkDir(basePath);
  return fixtures;
}

/**
 * Load fixtures matching a glob-like pattern
 *
 * @param pattern - Simple pattern with * wildcard (e.g., 'code-snippets/auth/*.ts')
 * @returns Array of matching fixtures
 *
 * @example
 * const authCode = await loadFixturesByPattern('code-snippets/auth/*.ts');
 * const allTs = await loadFixturesByPattern('**\/*.ts');
 */
export async function loadFixturesByPattern(pattern: string): Promise<Fixture[]> {
  // Convert simple glob pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '{{DOUBLE_STAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLE_STAR}}/g, '.*')
    .replace(/\//g, '\\/');

  const regex = new RegExp(`^${regexPattern}$`);

  // Load all fixtures and filter by pattern
  const allFixtures = await loadAllFixturesRecursive();
  return allFixtures.filter((f) => regex.test(f.path));
}

/**
 * Load all fixtures recursively from the fixtures directory
 */
async function loadAllFixturesRecursive(): Promise<Fixture[]> {
  const fixtures: Fixture[] = [];

  async function walkDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && entry.name !== 'README.md') {
        const relativePath = relative(FIXTURES_DIR, fullPath);
        const fixture = await loadFixture(relativePath);
        fixtures.push(fixture);
      }
    }
  }

  await walkDir(FIXTURES_DIR);
  return fixtures;
}

/**
 * Get fixture paths without loading content (for listing)
 *
 * @param subdir - Optional subdirectory to list
 * @returns Array of relative paths
 */
export async function listFixtures(subdir?: string): Promise<string[]> {
  const basePath = subdir ? join(FIXTURES_DIR, subdir) : FIXTURES_DIR;
  const paths: string[] = [];

  async function walkDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && entry.name !== 'README.md') {
        paths.push(relative(FIXTURES_DIR, fullPath));
      }
    }
  }

  await walkDir(basePath);
  return paths.sort();
}

/**
 * Fixture categories for easy access
 */
export const FixtureCategories = {
  GITHUB_READMES: 'github-readmes',
  CODE_AUTH: 'code-snippets/auth',
  CODE_API: 'code-snippets/api',
  CODE_DATABASE: 'code-snippets/database',
  DOCUMENTATION: 'documentation',
} as const;

/**
 * Load fixtures by category
 *
 * @param category - One of the predefined fixture categories
 * @returns Array of fixtures in that category
 *
 * @example
 * const authFixtures = await loadByCategory(FixtureCategories.CODE_AUTH);
 */
export async function loadByCategory(
  category: (typeof FixtureCategories)[keyof typeof FixtureCategories]
): Promise<Fixture[]> {
  return loadAllFixtures(category, false);
}

/**
 * Count total fixtures available
 */
export async function countFixtures(): Promise<number> {
  const paths = await listFixtures();
  return paths.length;
}

/**
 * Get total size of all fixtures
 */
export async function getTotalFixtureSize(): Promise<number> {
  const fixtures = await loadAllFixturesRecursive();
  return fixtures.reduce((sum, f) => sum + f.size, 0);
}
