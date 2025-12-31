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

export class RepoUrlResolver {
  /**
   * Find the GitHub repository URL for a package
   */
  async findRepoUrl(
    packageName: string,
    language: 'javascript' | 'python' = 'javascript'
  ): Promise<RepoSearchResult> {
    // Strategy 1: Try package registry API (fast, accurate)
    if (language === 'javascript') {
      const npmUrl = await this.tryNpmRegistry(packageName);
      if (npmUrl !== null) {
        return { url: npmUrl, confidence: 'high', source: 'registry' };
      }
    } else {
      const pypiUrl = await this.tryPyPiRegistry(packageName);
      if (pypiUrl !== null) {
        return { url: pypiUrl, confidence: 'high', source: 'registry' };
      }
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
