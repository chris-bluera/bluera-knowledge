import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RepoUrlResolver } from './repo-url-resolver.js';

describe('RepoUrlResolver', () => {
  let resolver: RepoUrlResolver;

  beforeEach(() => {
    resolver = new RepoUrlResolver();
    // Mock global fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('NPM registry lookup', () => {
    it('finds repo URL from npm registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            type: 'git',
            url: 'git+https://github.com/lodash/lodash.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('lodash', 'javascript');

      expect(result.url).toBe('https://github.com/lodash/lodash');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('registry');
    });

    it('handles repository as string', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: 'https://github.com/user/repo'
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
      expect(result.confidence).toBe('high');
    });

    it('handles 404 from npm registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await resolver.findRepoUrl('nonexistent', 'javascript');

      expect(result.url).toBeNull();
      expect(result.confidence).toBe('low');
    });

    it('handles network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
      expect(result.confidence).toBe('low');
    });

    it('handles malformed JSON from registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('handles missing repository field', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'package',
          version: '1.0.0'
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });
  });

  describe('PyPI registry lookup', () => {
    it('finds repo URL from PyPI registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            project_urls: {
              Source: 'https://github.com/psf/requests'
            }
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('requests', 'python');

      expect(result.url).toBe('https://github.com/psf/requests');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('registry');
    });

    it('tries multiple URL keys in order', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            project_urls: {
              Homepage: 'https://example.com',
              Repository: 'https://github.com/user/repo'
            }
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'python');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('prefers Source over other keys', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            project_urls: {
              Source: 'https://github.com/owner/repo1',
              Code: 'https://github.com/owner/repo2'
            }
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'python');

      expect(result.url).toBe('https://github.com/owner/repo1');
    });

    it('only returns GitHub URLs', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            project_urls: {
              Source: 'https://gitlab.com/user/repo'
            }
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'python');

      expect(result.url).toBeNull();
    });

    it('handles 404 from PyPI', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await resolver.findRepoUrl('nonexistent', 'python');

      expect(result.url).toBeNull();
    });

    it('handles missing project_urls field', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          info: {
            name: 'package'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'python');

      expect(result.url).toBeNull();
    });
  });

  describe('URL normalization', () => {
    it('removes git+ prefix', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'git+https://github.com/user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('removes .git suffix', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'https://github.com/user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('converts git:// to https://', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'git://github.com/user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('converts ssh:// URLs', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'ssh://git@github.com/user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('converts git@github.com: format', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'git@github.com:user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });

    it('rejects non-GitHub URLs', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'https://bitbucket.org/user/repo'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('handles already normalized URLs', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'https://github.com/user/repo'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBe('https://github.com/user/repo');
    });
  });

  describe('crates.io registry lookup', () => {
    it('finds repo URL from crates.io registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          crate: {
            repository: 'https://github.com/serde-rs/serde'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('serde', 'rust');

      expect(result.url).toBe('https://github.com/serde-rs/serde');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('registry');
    });

    it('includes User-Agent header for crates.io', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          crate: {
            repository: 'https://github.com/user/repo'
          }
        })
      } as Response);

      await resolver.findRepoUrl('tokio', 'rust');

      expect(fetch).toHaveBeenCalledWith(
        'https://crates.io/api/v1/crates/tokio',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('bluera-knowledge')
          })
        })
      );
    });

    it('handles 404 from crates.io', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await resolver.findRepoUrl('nonexistent-crate', 'rust');

      expect(result.url).toBeNull();
      expect(result.confidence).toBe('low');
    });

    it('handles missing repository field in crate', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          crate: {
            name: 'some-crate',
            version: '1.0.0'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('some-crate', 'rust');

      expect(result.url).toBeNull();
    });

    it('normalizes crates.io URLs', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          crate: {
            repository: 'git+https://github.com/user/repo.git'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('crate', 'rust');

      expect(result.url).toBe('https://github.com/user/repo');
    });
  });

  describe('Go module lookup', () => {
    it('resolves github.com module paths directly', async () => {
      const result = await resolver.findRepoUrl('github.com/gorilla/mux', 'go');

      expect(result.url).toBe('https://github.com/gorilla/mux');
      expect(result.confidence).toBe('high');
      expect(result.source).toBe('registry');
      // Should not make any fetch calls for direct GitHub modules
      expect(fetch).not.toHaveBeenCalled();
    });

    it('handles versioned github.com module paths', async () => {
      const result = await resolver.findRepoUrl('github.com/go-chi/chi/v5', 'go');

      expect(result.url).toBe('https://github.com/go-chi/chi');
      expect(result.confidence).toBe('high');
    });

    it('handles deeply nested github.com module paths', async () => {
      const result = await resolver.findRepoUrl('github.com/aws/aws-sdk-go/service/s3', 'go');

      expect(result.url).toBe('https://github.com/aws/aws-sdk-go');
      expect(result.confidence).toBe('high');
    });

    it('returns null for non-github modules when proxy fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 404
      } as Response);

      const result = await resolver.findRepoUrl('golang.org/x/net', 'go');

      expect(result.url).toBeNull();
      expect(result.confidence).toBe('low');
    });

    it('handles invalid github.com paths', async () => {
      // Only one path component after github.com
      const result = await resolver.findRepoUrl('github.com/incomplete', 'go');

      expect(result.url).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('handles scoped npm packages', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'https://github.com/org/package'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('@org/package', 'javascript');

      expect(result.url).toBe('https://github.com/org/package');
      expect(fetch).toHaveBeenCalledWith('https://registry.npmjs.org/@org/package');
    });

    it('handles packages with hyphens', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: 'https://github.com/user/my-package'
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('my-package', 'javascript');

      expect(result.url).toBe('https://github.com/user/my-package');
    });

    it('handles empty response body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => null
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('handles array in repository field', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: []
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('handles null repository URL', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: null
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('handles undefined values gracefully', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          repository: {
            url: undefined
          }
        })
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.url).toBeNull();
    });

    it('uses fallback when all strategies fail', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      const result = await resolver.findRepoUrl('package', 'javascript');

      expect(result.source).toBe('fallback');
      expect(result.confidence).toBe('low');
    });
  });
});
