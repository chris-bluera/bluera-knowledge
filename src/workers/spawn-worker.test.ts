import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock child_process before importing spawn-worker
const mockUnref = vi.fn();
const mockSpawn = vi.fn(() => ({
  unref: mockUnref,
}));

vi.mock('child_process', () => ({
  spawn: mockSpawn,
}));

// Import after mocking
const { spawnBackgroundWorker } = await import('./spawn-worker.js');

describe('spawnBackgroundWorker', () => {
  beforeEach(() => {
    mockSpawn.mockClear();
    mockUnref.mockClear();
  });

  it('should use tsx in development mode (src folder)', () => {
    spawnBackgroundWorker('test-job', '/test/data');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [command, args] = mockSpawn.mock.calls[0] as [string, string[], object];

    // In development (src folder), should use npx tsx
    expect(command).toBe('npx');
    expect(args[0]).toBe('tsx');
  });

  it('should spawn a background worker process', () => {
    spawnBackgroundWorker('test-job-id', '/test/data/dir');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockUnref).toHaveBeenCalledTimes(1);
  });

  it('should pass job ID as argument', () => {
    spawnBackgroundWorker('my-job-123', '/test/data/dir');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [, args] = mockSpawn.mock.calls[0] as [string, string[], object];

    expect(args).toContain('my-job-123');
  });

  it('should spawn detached process with ignored stdio', () => {
    spawnBackgroundWorker('test-job', '/test/data/dir');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [, , options] = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { detached: boolean; stdio: string },
    ];

    expect(options).toMatchObject({
      detached: true,
      stdio: 'ignore',
    });
  });

  it('should pass environment variables including BLUERA_DATA_DIR', () => {
    const dataDir = '/custom/data/directory';
    spawnBackgroundWorker('test-job', dataDir);

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [, , options] = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];

    expect(options.env).toMatchObject({
      ...process.env,
      BLUERA_DATA_DIR: dataDir,
    });
  });

  it('should pass dataDir via BLUERA_DATA_DIR environment variable', () => {
    const testDataDir = '.bluera/bluera-knowledge/data';
    spawnBackgroundWorker('job-456', testDataDir);

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [, , options] = mockSpawn.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string> },
    ];

    expect(options.env.BLUERA_DATA_DIR).toBe(testDataDir);
  });
});

// Test production mode with separate import to get fresh module
describe('spawnBackgroundWorker (production mode)', () => {
  const mockUnrefProd = vi.fn();
  const mockSpawnProd = vi.fn(() => ({
    unref: mockUnrefProd,
  }));

  beforeEach(() => {
    vi.resetModules();
    mockSpawnProd.mockClear();
    mockUnrefProd.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use Node.js directly in production mode (dist folder)', async () => {
    // Mock child_process
    vi.doMock('child_process', () => ({
      spawn: mockSpawnProd,
    }));

    // Mock url module to return a path containing /dist/
    vi.doMock('url', () => ({
      fileURLToPath: () => '/app/dist/workers/spawn-worker.js',
    }));

    // Import fresh module with production path
    const { spawnBackgroundWorker: spawnProd } = await import('./spawn-worker.js');

    spawnProd('test-job', '/test/data');

    expect(mockSpawnProd).toHaveBeenCalledTimes(1);
    const [command, args] = mockSpawnProd.mock.calls[0] as [string, string[]];

    // In production (dist folder), should use Node.js directly
    expect(command).toBe(process.execPath);
    expect(args[0]).toContain('background-worker-cli.js');
    expect(args[1]).toBe('test-job');
  });
});
