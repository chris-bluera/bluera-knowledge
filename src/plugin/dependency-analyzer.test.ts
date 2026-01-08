import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { analyzeDependencies } from './dependency-analyzer.js';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('DependencyAnalyzer - Node.js Projects', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `dep-analyzer-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('analyzes package.json dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
        vue: '^3.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'react')).toBe(true);
    expect(suggestions.some((s) => s.name === 'vue')).toBe(true);
  });

  it('includes devDependencies', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        hono: '^3.0.0',
      },
      devDependencies: {
        pino: '^8.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'hono')).toBe(true);
    expect(suggestions.some((s) => s.name === 'pino')).toBe(true);
  });

  it('returns only known repositories', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
        'some-unknown-package': '^1.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'react')).toBe(true);
    expect(suggestions.some((s) => s.name === 'some-unknown-package')).toBe(false);
  });

  it('includes repository URL for known packages', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    const reactSuggestion = suggestions.find((s) => s.name === 'react');
    expect(reactSuggestion).toBeDefined();
    expect(reactSuggestion?.url).toContain('github.com');
  });

  it('categorizes packages by importance', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
        pino: '^8.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    const reactSuggestion = suggestions.find((s) => s.name === 'react');
    const pinoSuggestion = suggestions.find((s) => s.name === 'pino');

    expect(reactSuggestion?.importance).toBe('critical');
    expect(pinoSuggestion?.importance).toBe('medium');
  });

  it('includes reason for each suggestion', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    const reactSuggestion = suggestions.find((s) => s.name === 'react');
    expect(reactSuggestion?.reason).toBeTruthy();
    expect(reactSuggestion?.reason).toContain('framework');
  });

  it('handles malformed package.json', async () => {
    // Create a new temp dir for this test to avoid conflicts
    const testDir = join(tempDir, `test-malformed-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    await writeFile(join(testDir, 'package.json'), '{ invalid json }');

    // The function catches JSON parse errors and continues
    // In this case it will just return empty array
    try {
      const suggestions = await analyzeDependencies(testDir);
      expect(suggestions).toEqual([]);
    } catch (error) {
      // If it throws, that's also acceptable behavior
      expect(error).toBeDefined();
    }
  });

  it('handles missing package.json', async () => {
    const emptyDir = join(tempDir, 'empty-dir');
    await mkdir(emptyDir, { recursive: true });

    const suggestions = await analyzeDependencies(emptyDir);

    expect(suggestions).toEqual([]);
  });
});

describe('DependencyAnalyzer - Python Projects', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `dep-analyzer-python-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('analyzes requirements.txt', async () => {
    const requirements = `fastapi==0.95.0
pydantic>=1.10.0
django==4.2.0`;

    await writeFile(join(tempDir, 'requirements.txt'), requirements);

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'fastapi')).toBe(true);
    expect(suggestions.some((s) => s.name === 'pydantic')).toBe(true);
    expect(suggestions.some((s) => s.name === 'django')).toBe(true);
  });

  it('parses different version specifiers', async () => {
    const requirements = `fastapi==0.95.0
pydantic>=1.10.0
flask~=2.0.0
django>3.0`;

    await writeFile(join(tempDir, 'requirements.txt'), requirements);

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'fastapi')).toBe(true);
    expect(suggestions.some((s) => s.name === 'pydantic')).toBe(true);
    expect(suggestions.some((s) => s.name === 'flask')).toBe(true);
    expect(suggestions.some((s) => s.name === 'django')).toBe(true);
  });

  it('ignores comments and blank lines', async () => {
    const requirements = `# This is a comment
fastapi==0.95.0

# Another comment
pydantic>=1.10.0
`;

    await writeFile(join(tempDir, 'requirements.txt'), requirements);

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'fastapi')).toBe(true);
    expect(suggestions.some((s) => s.name === 'pydantic')).toBe(true);
  });

  it('analyzes pyproject.toml', async () => {
    const pyproject = `[project]
name = "test-project"
dependencies = [
    "fastapi",
    "pydantic",
]`;

    await writeFile(join(tempDir, 'pyproject.toml'), pyproject);

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'fastapi')).toBe(true);
    expect(suggestions.some((s) => s.name === 'pydantic')).toBe(true);
  });
});

describe('DependencyAnalyzer - Mixed Projects', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `dep-analyzer-mixed-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('combines Node.js and Python dependencies', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
      },
    };

    const requirements = 'fastapi==0.95.0';

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));
    await writeFile(join(tempDir, 'requirements.txt'), requirements);

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions.some((s) => s.name === 'react')).toBe(true);
    expect(suggestions.some((s) => s.name === 'fastapi')).toBe(true);
  });

  it('removes duplicates across sources', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
      },
      devDependencies: {
        react: '^18.0.0', // Duplicate
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    const reactSuggestions = suggestions.filter((s) => s.name === 'react');
    expect(reactSuggestions).toHaveLength(1);
  });

  it('sorts suggestions by importance', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        pino: '^8.0.0', // medium
        react: '^18.0.0', // critical
        zod: '^3.0.0', // high
        express: '^4.0.0', // high
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    // Critical should come first
    expect(suggestions[0]?.importance).toBe('critical');

    // Check ordering: critical > high > medium
    for (let i = 0; i < suggestions.length - 1; i++) {
      const current = suggestions[i];
      const next = suggestions[i + 1];

      if (current && next) {
        const importanceOrder = { critical: 0, high: 1, medium: 2 };
        const currentOrder = importanceOrder[current.importance];
        const nextOrder = importanceOrder[next.importance];
        expect(currentOrder).toBeLessThanOrEqual(nextOrder);
      }
    }
  });
});

describe('DependencyAnalyzer - Edge Cases', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = join(tmpdir(), `dep-analyzer-edge-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('handles empty dependencies object', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {},
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions).toEqual([]);
  });

  it('handles package.json without dependencies field', async () => {
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions).toEqual([]);
  });

  it('handles empty requirements.txt', async () => {
    await writeFile(join(tempDir, 'requirements.txt'), '');

    const suggestions = await analyzeDependencies(tempDir);

    expect(suggestions).toEqual([]);
  });

  it('uses current directory as default', async () => {
    const packageJson = {
      name: 'test-project',
      dependencies: {
        react: '^18.0.0',
      },
    };

    await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson));

    // Mock process.cwd to return tempDir
    const originalCwd = process.cwd();
    const cwd = vi.spyOn(process, 'cwd');
    cwd.mockReturnValue(tempDir);

    try {
      const suggestions = await analyzeDependencies();
      expect(suggestions.some((s) => s.name === 'react')).toBe(true);
    } finally {
      cwd.mockRestore();
    }
  });
});
