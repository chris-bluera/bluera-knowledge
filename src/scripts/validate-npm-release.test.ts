import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for validate-npm-release.sh script.
 * Ensures the script follows best practices for cross-platform compatibility.
 */
describe('validate-npm-release.sh', () => {
  const scriptPath = join(process.cwd(), 'scripts/validate-npm-release.sh');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  it('does not use hardcoded /tmp paths', () => {
    // Script should use mktemp -d for temporary directories, not hardcoded /tmp
    // This ensures better cross-platform compatibility and avoids path collisions

    // Check for hardcoded /tmp assignments (excluding comments)
    const lines = scriptContent.split('\n').filter((line) => !line.trim().startsWith('#'));
    const hasHardcodedTmp = lines.some((line) => /=["']?\/tmp\//.test(line));

    expect(hasHardcodedTmp).toBe(false);
  });

  it('uses mktemp for temporary directories', () => {
    // Should use mktemp -d for creating temporary directories
    expect(scriptContent).toContain('mktemp -d');
  });

  it('cleans up temporary directories on exit', () => {
    // Should have a trap to clean up on exit
    expect(scriptContent).toContain('trap');
    expect(scriptContent).toMatch(/rm -rf/);
  });
});
