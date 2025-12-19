import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChangeApplier } from '../../../src/services/auto-improve/change-applier.js';
import type { Change } from '../../../src/services/auto-improve/types.js';

describe('ChangeApplier', () => {
  let tempDir: string;
  let applier: ChangeApplier;

  beforeEach(() => {
    tempDir = join(tmpdir(), `change-applier-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    applier = new ChangeApplier(tempDir);
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('apply', () => {
    it('applies a config change by replacing content', async () => {
      const configPath = join(tempDir, 'src', 'config.json');
      writeFileSync(configPath, '{"chunkSize": 512}');

      const change: Change = {
        type: 'config',
        priority: 1,
        file: configPath,
        description: 'Increase chunk size',
        before: '{"chunkSize": 512}',
        after: '{"chunkSize": 1024}',
      };

      const result = await applier.apply([change]);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(readFileSync(configPath, 'utf-8')).toBe('{"chunkSize": 1024}');
    });

    it('applies a code change with partial replacement', async () => {
      const codePath = join(tempDir, 'src', 'search.ts');
      writeFileSync(codePath, `
export function search() {
  const boost = 1.0;
  return boost;
}
`);

      const change: Change = {
        type: 'code',
        priority: 1,
        file: codePath,
        description: 'Increase boost multiplier',
        before: 'const boost = 1.0;',
        after: 'const boost = 1.5;',
      };

      const result = await applier.apply([change]);

      expect(result.success).toBe(true);
      const content = readFileSync(codePath, 'utf-8');
      expect(content).toContain('const boost = 1.5;');
      expect(content).toContain('return boost;');
    });

    it('applies multiple changes in priority order', async () => {
      const file1 = join(tempDir, 'src', 'file1.ts');
      const file2 = join(tempDir, 'src', 'file2.ts');
      writeFileSync(file1, 'const a = 1;');
      writeFileSync(file2, 'const b = 2;');

      const changes: Change[] = [
        {
          type: 'code',
          priority: 2, // Lower priority, applied second
          file: file2,
          description: 'Change b',
          before: 'const b = 2;',
          after: 'const b = 20;',
        },
        {
          type: 'config',
          priority: 1, // Higher priority, applied first
          file: file1,
          description: 'Change a',
          before: 'const a = 1;',
          after: 'const a = 10;',
        },
      ];

      const result = await applier.apply(changes);

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(2);
      expect(result.order).toEqual([file1, file2]); // Priority order
    });

    it('reports failure when before content does not match', async () => {
      const configPath = join(tempDir, 'src', 'config.json');
      writeFileSync(configPath, '{"chunkSize": 256}'); // Different from expected

      const change: Change = {
        type: 'config',
        priority: 1,
        file: configPath,
        description: 'Increase chunk size',
        before: '{"chunkSize": 512}', // Expected but not found
        after: '{"chunkSize": 1024}',
      };

      const result = await applier.apply([change]);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/content.*not match|not found/i);
    });

    it('reports failure when file does not exist', async () => {
      const change: Change = {
        type: 'config',
        priority: 1,
        file: join(tempDir, 'nonexistent.json'),
        description: 'Change config',
        before: '{"a": 1}',
        after: '{"a": 2}',
      };

      const result = await applier.apply([change]);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toMatch(/not found|ENOENT/i);
    });

    it('stops on first error and reports partial success', async () => {
      const file1 = join(tempDir, 'src', 'file1.ts');
      writeFileSync(file1, 'const a = 1;');

      const changes: Change[] = [
        {
          type: 'config',
          priority: 1,
          file: file1,
          description: 'Change a',
          before: 'const a = 1;',
          after: 'const a = 10;',
        },
        {
          type: 'config',
          priority: 2,
          file: join(tempDir, 'nonexistent.json'), // Will fail
          description: 'Change nonexistent',
          before: '{}',
          after: '{"x": 1}',
        },
      ];

      const result = await applier.apply(changes);

      expect(result.success).toBe(false);
      expect(result.appliedCount).toBe(1);
      expect(readFileSync(file1, 'utf-8')).toBe('const a = 10;');
    });
  });

  describe('validate', () => {
    it('validates changes without applying them', async () => {
      const configPath = join(tempDir, 'src', 'config.json');
      writeFileSync(configPath, '{"chunkSize": 512}');

      const change: Change = {
        type: 'config',
        priority: 1,
        file: configPath,
        description: 'Increase chunk size',
        before: '{"chunkSize": 512}',
        after: '{"chunkSize": 1024}',
      };

      const result = await applier.validate([change]);

      expect(result.valid).toBe(true);
      // File should not be changed
      expect(readFileSync(configPath, 'utf-8')).toBe('{"chunkSize": 512}');
    });

    it('reports validation errors for mismatched content', async () => {
      const configPath = join(tempDir, 'src', 'config.json');
      writeFileSync(configPath, '{"chunkSize": 256}');

      const change: Change = {
        type: 'config',
        priority: 1,
        file: configPath,
        description: 'Increase chunk size',
        before: '{"chunkSize": 512}', // Wrong expected content
        after: '{"chunkSize": 1024}',
      };

      const result = await applier.validate([change]);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('revert', () => {
    it('reverts changes using before content', async () => {
      const configPath = join(tempDir, 'src', 'config.json');
      writeFileSync(configPath, '{"chunkSize": 1024}'); // Already changed

      const change: Change = {
        type: 'config',
        priority: 1,
        file: configPath,
        description: 'Increase chunk size',
        before: '{"chunkSize": 512}',
        after: '{"chunkSize": 1024}',
      };

      await applier.revert([change]);

      expect(readFileSync(configPath, 'utf-8')).toBe('{"chunkSize": 512}');
    });

    it('reverts multiple changes in reverse priority order', async () => {
      const file1 = join(tempDir, 'src', 'file1.ts');
      const file2 = join(tempDir, 'src', 'file2.ts');
      writeFileSync(file1, 'const a = 10;');
      writeFileSync(file2, 'const b = 20;');

      const changes: Change[] = [
        {
          type: 'code',
          priority: 1,
          file: file1,
          description: 'Change a',
          before: 'const a = 1;',
          after: 'const a = 10;',
        },
        {
          type: 'config',
          priority: 2,
          file: file2,
          description: 'Change b',
          before: 'const b = 2;',
          after: 'const b = 20;',
        },
      ];

      await applier.revert(changes);

      expect(readFileSync(file1, 'utf-8')).toBe('const a = 1;');
      expect(readFileSync(file2, 'utf-8')).toBe('const b = 2;');
    });
  });
});
