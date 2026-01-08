import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneRepository, isGitUrl, extractRepoName } from './git-clone.js';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('GitClone - cloneRepository', () => {
  let tempDir: string;
  let mockSpawn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `git-clone-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    const { spawn } = await import('node:child_process');
    mockSpawn = vi.mocked(spawn);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('clones repository successfully', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      // Emit close event immediately after spawn
      setImmediate(() => {
        mockProcess.emit('close', 0);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(join(tempDir, 'repo'));
    }
  });

  it('passes correct arguments to git clone', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => mockProcess.emit('close', 0));
      return mockProcess;
    });

    await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '1', 'https://github.com/user/repo.git', join(tempDir, 'repo')],
      expect.any(Object)
    );
  });

  it('includes branch when specified', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => mockProcess.emit('close', 0));
      return mockProcess;
    });

    await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
      branch: 'develop',
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      [
        'clone',
        '--depth',
        '1',
        '--branch',
        'develop',
        'https://github.com/user/repo.git',
        join(tempDir, 'repo'),
      ],
      expect.any(Object)
    );
  });

  it('uses custom depth when provided', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => mockProcess.emit('close', 0));
      return mockProcess;
    });

    await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
      depth: 10,
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      ['clone', '--depth', '10', 'https://github.com/user/repo.git', join(tempDir, 'repo')],
      expect.any(Object)
    );
  });

  it('defaults to depth 1 for shallow clone', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => mockProcess.emit('close', 0));
      return mockProcess;
    });

    await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(mockSpawn).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['--depth', '1']),
      expect.any(Object)
    );
  });

  it('returns error on non-zero exit code', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        (mockProcess.stderr as any).emit('data', Buffer.from('Repository not found'));
        mockProcess.emit('close', 128);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/nonexistent.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Git clone failed');
      expect(result.error.message).toContain('Repository not found');
    }
  });

  it('captures stderr output on failure', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        (mockProcess.stderr as any).emit('data', Buffer.from('Error: Authentication failed\n'));
        (mockProcess.stderr as any).emit('data', Buffer.from('fatal: unable to access\n'));
        mockProcess.emit('close', 1);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Authentication failed');
      expect(result.error.message).toContain('fatal: unable to access');
    }
  });

  it('handles network errors', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        (mockProcess.stderr as any).emit('data', Buffer.from('fatal: unable to connect'));
        mockProcess.emit('close', 128);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('unable to connect');
    }
  });

  it('handles permission errors', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        (mockProcess.stderr as any).emit('data', Buffer.from('Permission denied'));
        mockProcess.emit('close', 128);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('Permission denied');
    }
  });

  it('handles branch not found error', async () => {
    const mockProcess = new EventEmitter() as ChildProcess;
    mockProcess.stderr = new EventEmitter() as any;

    mockSpawn.mockImplementation(() => {
      setImmediate(() => {
        (mockProcess.stderr as any).emit(
          'data',
          Buffer.from('Remote branch nonexistent-branch not found')
        );
        mockProcess.emit('close', 128);
      });
      return mockProcess;
    });

    const result = await cloneRepository({
      url: 'https://github.com/user/repo.git',
      targetDir: join(tempDir, 'repo'),
      branch: 'nonexistent-branch',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('not found');
    }
  });
});

describe('GitClone - isGitUrl', () => {
  it('recognizes https URLs', () => {
    expect(isGitUrl('https://github.com/user/repo.git')).toBe(true);
  });

  it('recognizes http URLs', () => {
    expect(isGitUrl('http://github.com/user/repo.git')).toBe(true);
  });

  it('recognizes git@ SSH URLs', () => {
    expect(isGitUrl('git@github.com:user/repo.git')).toBe(true);
  });

  it('rejects relative paths', () => {
    expect(isGitUrl('./local/path')).toBe(false);
  });

  it('rejects absolute file paths', () => {
    expect(isGitUrl('/absolute/path')).toBe(false);
  });

  it('rejects plain strings', () => {
    expect(isGitUrl('just-text')).toBe(false);
  });
});

describe('GitClone - extractRepoName', () => {
  it('extracts name from HTTPS URL with .git', () => {
    const name = extractRepoName('https://github.com/user/my-repo.git');
    expect(name).toBe('my-repo');
  });

  it('extracts name from HTTPS URL without .git', () => {
    const name = extractRepoName('https://github.com/user/my-repo');
    expect(name).toBe('my-repo');
  });

  it('extracts name from SSH URL', () => {
    const name = extractRepoName('git@github.com:user/my-repo.git');
    expect(name).toBe('my-repo');
  });

  it('extracts name from nested path', () => {
    const name = extractRepoName('https://gitlab.com/org/subgroup/project.git');
    expect(name).toBe('project');
  });

  it('handles URL with trailing slash', () => {
    const name = extractRepoName('https://github.com/user/repo.git/');
    // Trailing slash makes the regex not match, so returns default 'repository'
    expect(name).toBe('repository');
  });

  it('returns "repository" for invalid URL', () => {
    const name = extractRepoName('https://github.com/');
    expect(name).toBe('repository');
  });

  it('extracts name from GitHub shorthand', () => {
    const name = extractRepoName('github.com/user/awesome-project');
    expect(name).toBe('awesome-project');
  });

  it('handles dashes and underscores in repo name', () => {
    const name = extractRepoName('https://github.com/user/my_cool-repo.git');
    expect(name).toBe('my_cool-repo');
  });

  it('handles numeric repo names', () => {
    const name = extractRepoName('https://github.com/user/123-repo.git');
    expect(name).toBe('123-repo');
  });
});
