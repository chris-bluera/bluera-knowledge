export interface RepoSearchResult {
  url: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'registry' | 'search' | 'fallback';
}

/**
 * Type guard to check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null;
}

export type SupportedLanguage = 'javascript' | 'python' | 'rust' | 'go';

export class RepoUrlResolver {
  /**
   * Find the GitHub repository URL for a package
   */
  async findRepoUrl(
    packageName: string,
    language: SupportedLanguage = 'javascript'
  ): Promise<RepoSearchResult> {
    // Strategy 1: Try package registry API (fast, accurate)
    let registryUrl: string | null = null;

    switch (language) {
      case 'javascript':
        registryUrl = await this.tryNpmRegistry(packageName);
        break;
      case 'python':
        registryUrl = await this.tryPyPiRegistry(packageName);
        break;
      case 'rust':
        registryUrl = await this.tryCratesRegistry(packageName);
        break;
      case 'go':
        registryUrl = await this.tryGoModule(packageName);
        break;
    }

    if (registryUrl !== null) {
      return { url: registryUrl, confidence: 'high', source: 'registry' };
    }

    // Strategy 2: No URL found
    return { url: null, confidence: 'low', source: 'fallback' };
  }

  /**
   * Query NPM registry for package metadata
   */
  private async tryNpmRegistry(packageName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://registry.npmjs.org/${packageName}`);

      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      if (!isObject(data)) {
        return null;
      }

      // Extract repository URL - safely access nested property
      if ('repository' in data) {
        const repo = data['repository'];
        if (isObject(repo) && 'url' in repo) {
          const urlValue = repo['url'];
          const url = String(urlValue);
          return this.normalizeRepoUrl(url);
        }

        if (typeof repo === 'string') {
          return this.normalizeRepoUrl(repo);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Query PyPI registry for package metadata
   */
  private async tryPyPiRegistry(packageName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);

      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      if (!isObject(data)) {
        return null;
      }

      // Extract repository URL from project URLs
      if ('info' in data) {
        const info = data['info'];
        if (isObject(info) && 'project_urls' in info) {
          const projectUrls = info['project_urls'];

          if (isObject(projectUrls)) {
            // Try various common keys
            const urlKeys = ['Source', 'Repository', 'Code', 'Homepage'];

            for (const key of urlKeys) {
              if (key in projectUrls) {
                const urlValue = projectUrls[key];
                const url = String(urlValue);
                if (url.includes('github.com')) {
                  return this.normalizeRepoUrl(url);
                }
              }
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Query crates.io registry for Rust crate metadata
   */
  private async tryCratesRegistry(crateName: string): Promise<string | null> {
    try {
      const response = await fetch(`https://crates.io/api/v1/crates/${crateName}`, {
        headers: {
          // crates.io requires a User-Agent header
          'User-Agent': 'bluera-knowledge (https://github.com/blueraai/bluera-knowledge)',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();
      if (!isObject(data)) {
        return null;
      }

      // Extract repository URL from crate metadata
      if ('crate' in data) {
        const crate = data['crate'];
        if (isObject(crate) && 'repository' in crate) {
          const repo = crate['repository'];
          if (typeof repo === 'string') {
            return this.normalizeRepoUrl(repo);
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve Go module to GitHub repository
   * Go modules often use GitHub URLs directly (e.g., github.com/gorilla/mux)
   */
  private async tryGoModule(moduleName: string): Promise<string | null> {
    try {
      // Go modules that start with github.com are already GitHub URLs
      if (moduleName.startsWith('github.com/')) {
        // Extract owner/repo from module path (e.g., github.com/gorilla/mux/v2 -> github.com/gorilla/mux)
        const parts = moduleName.split('/');
        const owner = parts[1];
        const repo = parts[2];
        if (owner !== undefined && repo !== undefined) {
          return `https://github.com/${owner}/${repo}`;
        }
      }

      // For other modules, try pkg.go.dev API
      // The pkg.go.dev API returns module info including repository URL
      const response = await fetch(`https://proxy.golang.org/${moduleName}/@latest`, {
        headers: {
          'User-Agent': 'bluera-knowledge (https://github.com/blueraai/bluera-knowledge)',
        },
      });

      if (!response.ok) {
        return null;
      }

      // The Go proxy returns module info, but repository URL needs to be inferred
      // from the module path or VCS info. For now, we only support direct GitHub modules.
      // Most popular Go packages use github.com paths anyway.
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Normalize various repository URL formats to standard GitHub URL
   */
  private normalizeRepoUrl(url: string): string | null {
    // Remove git+ prefix
    let normalized = url.replace(/^git\+/, '');

    // Remove .git suffix
    normalized = normalized.replace(/\.git$/, '');

    // Convert git:// to https://
    normalized = normalized.replace(/^git:\/\//, 'https://');

    // Convert ssh:// to https://
    normalized = normalized.replace(/^ssh:\/\/git@/, 'https://');

    // Convert git@github.com: to https://github.com/
    normalized = normalized.replace(/^git@github\.com:/, 'https://github.com/');

    // Only return if it's a GitHub URL
    if (normalized.includes('github.com')) {
      return normalized;
    }

    return null;
  }
}
