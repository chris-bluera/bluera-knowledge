import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectRootService } from './project-root.service.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    realpathSync: vi.fn((p: string) => p),
  };
});

describe('ProjectRootService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Clear relevant environment variables
    delete process.env.PROJECT_ROOT;
    delete process.env.PWD;

    // Reset mocks
    vi.clearAllMocks();

    // Setup default mock behaviors
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Path does not exist');
    });
    (fs.realpathSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => p);
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('resolve - Hierarchical Detection', () => {
    it('uses explicit projectRoot option as highest priority', () => {
      process.env.PROJECT_ROOT = '/env/project/root';
      process.env.PWD = '/env/pwd';

      const result = ProjectRootService.resolve({
        projectRoot: '/explicit/path',
      });

      expect(result).toBe(path.normalize('/explicit/path'));
    });

    it('uses PROJECT_ROOT env var when option not provided', () => {
      process.env.PROJECT_ROOT = '/env/project/root';
      process.env.PWD = '/env/pwd';

      const result = ProjectRootService.resolve();

      expect(result).toBe(path.normalize('/env/project/root'));
    });

    it('uses PWD env var when PROJECT_ROOT not set', () => {
      delete process.env.PROJECT_ROOT;
      process.env.PWD = '/env/pwd';

      const result = ProjectRootService.resolve();

      expect(result).toBe(path.normalize('/env/pwd'));
    });

    it('uses git root when no env vars set', () => {
      delete process.env.PROJECT_ROOT;
      delete process.env.PWD;

      const gitPath = path.join(process.cwd(), '.git');
      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });
      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isFile: () => false,
      } as fs.Stats);

      const result = ProjectRootService.resolve();

      expect(result).toBe(process.cwd());
    });

    it('falls back to process.cwd() when nothing else available', () => {
      delete process.env.PROJECT_ROOT;
      delete process.env.PWD;

      const result = ProjectRootService.resolve();

      expect(result).toBe(process.cwd());
    });

    it('ignores empty string in projectRoot option', () => {
      process.env.PROJECT_ROOT = '/env/project/root';

      const result = ProjectRootService.resolve({ projectRoot: '' });

      expect(result).toBe(path.normalize('/env/project/root'));
    });

    it('ignores empty string in PROJECT_ROOT env', () => {
      process.env.PROJECT_ROOT = '';
      process.env.PWD = '/env/pwd';

      const result = ProjectRootService.resolve();

      expect(result).toBe(path.normalize('/env/pwd'));
    });

    it('ignores empty string in PWD env', () => {
      delete process.env.PROJECT_ROOT;
      process.env.PWD = '';

      const result = ProjectRootService.resolve();

      expect(result).toBe(process.cwd());
    });
  });

  describe('normalize', () => {
    it('normalizes path with correct separators', () => {
      const result = ProjectRootService.normalize('/path/to/project');

      expect(result).toBe(path.normalize('/path/to/project'));
    });

    it('resolves symlinks to real paths', () => {
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue('/real/path');

      const result = ProjectRootService.normalize('/symlink/path');

      expect(fs.realpathSync).toHaveBeenCalledWith('/symlink/path');
      expect(result).toBe(path.normalize('/real/path'));
    });

    it('handles paths with .. correctly', () => {
      const inputPath = '/path/to/../project';
      const expectedPath = path.normalize('/path/project');

      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(expectedPath);

      const result = ProjectRootService.normalize(inputPath);

      expect(result).toBe(expectedPath);
    });

    it('handles paths with . correctly', () => {
      const inputPath = '/path/./project';
      const expectedPath = path.normalize('/path/project');

      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(expectedPath);

      const result = ProjectRootService.normalize(inputPath);

      expect(result).toBe(expectedPath);
    });

    it('falls back to normalize when realpath fails', () => {
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Path does not exist');
      });

      const result = ProjectRootService.normalize('/non/existent/path');

      expect(result).toBe(path.normalize('/non/existent/path'));
    });

    it('handles relative paths', () => {
      const relativePath = 'relative/path';
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Cannot resolve');
      });

      const result = ProjectRootService.normalize(relativePath);

      expect(result).toBe(path.normalize(relativePath));
    });
  });

  describe('findGitRoot', () => {
    it('finds .git directory in current directory', () => {
      const testPath = '/project/path';
      const gitPath = path.join(testPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isFile: () => false,
      } as fs.Stats);

      const result = ProjectRootService.findGitRoot(testPath);

      expect(result).toBe(testPath);
    });

    it('finds .git directory in parent directory', () => {
      const rootPath = '/project';
      const startPath = '/project/src/deep';
      const gitPath = path.join(rootPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isFile: () => false,
      } as fs.Stats);

      const result = ProjectRootService.findGitRoot(startPath);

      expect(result).toBe(rootPath);
    });

    it('handles .git file (submodule)', () => {
      const testPath = '/project/submodule';
      const gitPath = path.join(testPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => false,
        isFile: () => true,
      } as fs.Stats);

      const result = ProjectRootService.findGitRoot(testPath);

      expect(result).toBe(testPath);
    });

    it('returns null when no .git found', () => {
      const result = ProjectRootService.findGitRoot('/some/path');

      expect(result).toBeNull();
    });

    it('stops at filesystem root', () => {
      const result = ProjectRootService.findGitRoot(path.parse(process.cwd()).root);

      expect(result).toBeNull();
    });

    it('handles stat errors gracefully', () => {
      const testPath = '/project/path';
      const gitPath = path.join(testPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should continue searching upward
      const result = ProjectRootService.findGitRoot(testPath);

      expect(result).toBeNull();
    });

    it('ignores .git that is neither file nor directory', () => {
      const testPath = '/project/path';
      const gitPath = path.join(testPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => true,
      } as fs.Stats);

      const result = ProjectRootService.findGitRoot(testPath);

      expect(result).toBeNull();
    });

    it('walks up directory tree correctly', () => {
      const rootPath = '/project';
      const deepPath = '/project/a/b/c/d';
      const gitPath = path.join(rootPath, '.git');

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === gitPath;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isFile: () => false,
      } as fs.Stats);

      const result = ProjectRootService.findGitRoot(deepPath);

      expect(result).toBe(rootPath);
    });
  });

  describe('validate', () => {
    it('returns true for valid directory', () => {
      const testPath = '/valid/directory';

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
      } as fs.Stats);

      const result = ProjectRootService.validate(testPath);

      expect(result).toBe(true);
      expect(fs.statSync).toHaveBeenCalledWith(testPath);
    });

    it('returns false for file (not directory)', () => {
      const testPath = '/path/to/file.txt';

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => false,
      } as fs.Stats);

      const result = ProjectRootService.validate(testPath);

      expect(result).toBe(false);
    });

    it('returns false for non-existent path', () => {
      const testPath = '/non/existent/path';

      (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = ProjectRootService.validate(testPath);

      expect(result).toBe(false);
    });

    it('returns false on permission error', () => {
      const testPath = '/permission/denied';

      (fs.statSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = ProjectRootService.validate(testPath);

      expect(result).toBe(false);
    });

    it('handles symbolic links to directories', () => {
      const testPath = '/symlink/to/dir';

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isSymbolicLink: () => true,
      } as fs.Stats);

      const result = ProjectRootService.validate(testPath);

      expect(result).toBe(true);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('handles Windows-style paths', () => {
      if (process.platform === 'win32') {
        const result = ProjectRootService.normalize('C:\\Users\\test\\project');
        expect(result).toContain('Users');
      }
    });

    it('handles Unix-style paths', () => {
      const result = ProjectRootService.normalize('/home/user/project');
      expect(result).toBe(path.normalize('/home/user/project'));
    });

    it('resolves path with mixed separators', () => {
      const mixedPath = '/path/to\\project';
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Cannot resolve');
      });

      const result = ProjectRootService.normalize(mixedPath);

      expect(result).toBe(path.normalize(mixedPath));
    });

    it('handles very long paths', () => {
      const longPath = '/a'.repeat(100);
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(longPath);

      const result = ProjectRootService.normalize(longPath);

      expect(result).toBe(path.normalize(longPath));
    });

    it('handles paths with special characters', () => {
      const specialPath = '/path/with spaces/and-dashes/under_scores';
      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(specialPath);

      const result = ProjectRootService.normalize(specialPath);

      expect(result).toBe(path.normalize(specialPath));
    });

    it('resolves with multiple git repos in hierarchy', () => {
      const outerGit = '/outer/.git';
      const innerGit = '/outer/inner/.git';
      const startPath = '/outer/inner/src';

      (fs.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) => {
        return p === innerGit || p === outerGit;
      });

      (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({
        isDirectory: () => true,
        isFile: () => false,
      } as fs.Stats);

      // Should find the closest git root
      const result = ProjectRootService.findGitRoot(startPath);

      expect(result).toBe(path.normalize('/outer/inner'));
    });

    it('handles concurrent resolve calls', () => {
      process.env.PROJECT_ROOT = '/test/path';

      const results = Array.from({ length: 10 }, () => ProjectRootService.resolve());

      results.forEach((result) => {
        expect(result).toBe(path.normalize('/test/path'));
      });
    });

    it('integrates normalize with resolve', () => {
      const symlinkPath = '/symlink/project';
      const realPath = '/real/project';

      (fs.realpathSync as ReturnType<typeof vi.fn>).mockReturnValue(realPath);

      const result = ProjectRootService.resolve({
        projectRoot: symlinkPath,
      });

      expect(result).toBe(path.normalize(realPath));
    });
  });

  describe('Environment Variable Priority', () => {
    it('prefers PROJECT_ROOT over PWD', () => {
      process.env.PROJECT_ROOT = '/project/root';
      process.env.PWD = '/pwd/path';

      const result = ProjectRootService.resolve();

      expect(result).toBe(path.normalize('/project/root'));
    });

    it('uses PWD when PROJECT_ROOT is undefined', () => {
      delete process.env.PROJECT_ROOT;
      process.env.PWD = '/pwd/path';

      const result = ProjectRootService.resolve();

      expect(result).toBe(path.normalize('/pwd/path'));
    });

    it('option overrides all environment variables', () => {
      process.env.PROJECT_ROOT = '/project/root';
      process.env.PWD = '/pwd/path';

      const result = ProjectRootService.resolve({
        projectRoot: '/option/path',
      });

      expect(result).toBe(path.normalize('/option/path'));
    });

    it('handles changing environment variables between calls', () => {
      process.env.PROJECT_ROOT = '/first/path';
      const result1 = ProjectRootService.resolve();

      process.env.PROJECT_ROOT = '/second/path';
      const result2 = ProjectRootService.resolve();

      expect(result1).toBe(path.normalize('/first/path'));
      expect(result2).toBe(path.normalize('/second/path'));
    });
  });
});
