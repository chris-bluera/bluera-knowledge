export interface RepoSearchResult {
  url: string | null;
  confidence: 'high' | 'medium' | 'low';
  source: 'registry' | 'search' | 'fallback';
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

      const jsonData = await response.json();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = jsonData as Record<string, unknown>;

      // Extract repository URL
      const repo = data['repository'];
      if (typeof repo === 'object' && repo !== null && 'url' in repo) {
        const url = String(repo.url);
        return this.normalizeRepoUrl(url);
      }

      if (typeof repo === 'string') {
        return this.normalizeRepoUrl(repo);
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

      const jsonData = await response.json();
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const data = jsonData as Record<string, unknown>;

      // Extract repository URL from project URLs
      const info = data['info'];
      if (typeof info === 'object' && info !== null && 'project_urls' in info) {
        const projectUrls = info.project_urls;

        if (typeof projectUrls === 'object' && projectUrls !== null) {
          // Try various common keys
          const urlKeys = ['Source', 'Repository', 'Code', 'Homepage'];

          for (const key of urlKeys) {
            if (key in projectUrls && typeof projectUrls === 'object') {
              // Access the property safely
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              const urlsObj = projectUrls as Record<string, unknown>;
              const urlValue = urlsObj[key];
              const url = String(urlValue);
              if (url.includes('github.com')) {
                return this.normalizeRepoUrl(url);
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
