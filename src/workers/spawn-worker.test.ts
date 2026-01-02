import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing spawn-worker
const mockUnref = vi.fn();
const mockSpawn = vi.fn(() => ({
  unref: mockUnref
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn
}));

// Import after mocking
const { spawnBackgroundWorker } = await import('./spawn-worker.js');

describe('spawnBackgroundWorker', () => {
  beforeEach(() => {
    mockSpawn.mockClear();
    mockUnref.mockClear();
  });

  it('should spawn a background worker process', () => {
    spawnBackgroundWorker('test-job-id', '/test/data/dir');

    expect(mockSpawn).toHaveBeenCalled();
    expect(mockUnref).toHaveBeenCalled();
  });

  it('should pass job ID as argument', () => {
    spawnBackgroundWorker('my-job-123', '/test/data/dir');

    const callArgs = mockSpawn.mock.calls[0];
    const args = callArgs?.[1];

    expect(args).toContain('my-job-123');
  });

  it('should spawn detached process with ignored stdio', () => {
    spawnBackgroundWorker('test-job', '/test/data/dir');

    const callArgs = mockSpawn.mock.calls[0];
    const options = callArgs?.[2];

    expect(options).toMatchObject({
      detached: true,
      stdio: 'ignore'
    });
  });

  it('should pass environment variables including BLUERA_DATA_DIR', () => {
    const dataDir = '/custom/data/directory';
    spawnBackgroundWorker('test-job', dataDir);

    const callArgs = mockSpawn.mock.calls[0];
    const options = callArgs?.[2];

    expect(options?.env).toMatchObject({
      ...process.env,
      BLUERA_DATA_DIR: dataDir
    });
  });

  it('should pass dataDir via BLUERA_DATA_DIR environment variable', () => {
    const testDataDir = '.bluera/bluera-knowledge/data';
    spawnBackgroundWorker('job-456', testDataDir);

    const callArgs = mockSpawn.mock.calls[0];
    const options = callArgs?.[2];

    expect(options?.env?.BLUERA_DATA_DIR).toBe(testDataDir);
  });
});
